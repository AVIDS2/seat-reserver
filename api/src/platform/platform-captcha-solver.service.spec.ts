import { describe, expect, it, jest, afterEach } from '@jest/globals';
import {
  imageSizeFromDataUrl,
  loadCaptchaProviderProfiles,
  PlatformCaptchaSolverService,
} from './platform-captcha-solver.service';

/** 4x4 PNG so the header reader has real bytes to parse. */
const PNG_DATA_URL =
  'data:image/png;base64,' +
  Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0x90, 0x00, 0x00, 0x01, 0x40,
  ]).toString('base64');

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function modelReply(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('loadCaptchaProviderProfiles', () => {
  it('should read a single unnamed provider from the base variables', () => {
    const profiles = loadCaptchaProviderProfiles({
      PLATFORM_VLM_BASE_URL: 'https://example.test/v1',
      PLATFORM_VLM_API_KEY: 'key',
      PLATFORM_VLM_MODEL: 'some-vl',
    } as NodeJS.ProcessEnv);

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      name: 'default',
      baseUrl: 'https://example.test/v1',
      model: 'some-vl',
      configured: true,
    });
  });

  it('should apply presets and per-provider overrides for named providers', () => {
    const profiles = loadCaptchaProviderProfiles({
      PLATFORM_VLM_PROVIDERS: 'qwen,deepseek',
      PLATFORM_VLM_QWEN_API_KEY: 'qwen-key',
      PLATFORM_VLM_DEEPSEEK_API_KEY: 'deepseek-key',
      PLATFORM_VLM_DEEPSEEK_MODEL: 'deepseek-vl',
    } as NodeJS.ProcessEnv);

    expect(profiles.map((profile) => profile.name)).toEqual([
      'qwen',
      'deepseek',
    ]);
    expect(profiles[0]).toMatchObject({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3-vl-flash',
      configured: true,
    });
    expect(profiles[1]).toMatchObject({
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-vl',
      configured: true,
    });
  });

  it('should report missing variables instead of pretending to be configured', () => {
    const profiles = loadCaptchaProviderProfiles({
      PLATFORM_VLM_PROVIDERS: 'unknownvendor',
      PLATFORM_VLM_UNKNOWNVENDOR_BASE_URL: 'https://vendor.test/v1',
    } as NodeJS.ProcessEnv);

    expect(profiles[0]?.configured).toBe(false);
    expect(profiles[0]?.missing).toEqual([
      'PLATFORM_VLM_UNKNOWNVENDOR_API_KEY',
      'PLATFORM_VLM_UNKNOWNVENDOR_MODEL',
    ]);
  });

  it('should build arbitrary providers from the JSON variable', () => {
    const profiles = loadCaptchaProviderProfiles({
      PLATFORM_VLM_PROVIDERS_JSON: JSON.stringify([
        {
          name: 'mimo',
          baseUrl: 'https://mimo.test/v1/',
          apiKey: 'mimo-key',
          model: 'mimo-vl',
          coordinateMode: 'pixel',
        },
        { name: 'backup', baseUrl: 'https://backup.test/v1' },
      ]),
      PLATFORM_VLM_API_KEY: 'shared-key',
    } as NodeJS.ProcessEnv);

    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({
      name: 'mimo',
      baseUrl: 'https://mimo.test/v1',
      model: 'mimo-vl',
      coordinateMode: 'pixel',
      configured: true,
    });
    // apiKey falls back to the shared variable, model is still missing.
    expect(profiles[1]?.configured).toBe(false);
    expect(profiles[1]?.missing).toEqual(['model']);
  });
});

describe('imageSizeFromDataUrl', () => {
  it('should read PNG dimensions from the header', () => {
    expect(imageSizeFromDataUrl(PNG_DATA_URL)).toEqual({
      width: 400,
      height: 320,
    });
  });

  it('should reject non-image payloads', () => {
    expect(imageSizeFromDataUrl('data:text/plain;base64,AAAA')).toBeNull();
  });
});

describe('PlatformCaptchaSolverService', () => {
  function makeService(env: NodeJS.ProcessEnv) {
    const profiles = loadCaptchaProviderProfiles(env);
    return new PlatformCaptchaSolverService(profiles);
  }

  const env = {
    PLATFORM_VLM_BASE_URL: 'https://example.test/v1',
    PLATFORM_VLM_API_KEY: 'key',
    PLATFORM_VLM_MODEL: 'test-vl',
    PLATFORM_VLM_COORD_MODE: 'normalized',
  } as NodeJS.ProcessEnv;

  it('should map normalized boxes back to pixels and order points by the prompt', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        modelReply(
          JSON.stringify({
            targets: ['甲', '乙'],
            items: [
              { char: '乙', bbox: [500, 500, 600, 600] },
              { char: '甲', bbox: [100, 200, 200, 300] },
            ],
          }),
        ),
      ),
    ) as unknown as typeof fetch;

    const service = makeService(env);
    const result = await service.solve({
      image: PNG_DATA_URL,
      wordImage: PNG_DATA_URL,
      requiredClicks: 2,
    });

    // 400x320 image: normalized 100..200 -> x 40..80, y 64..96
    expect(result.points).toEqual([
      { x: 60, y: 80 },
      { x: 220, y: 176 },
    ]);
    expect(result.targets).toEqual(['甲', '乙']);
    expect(result.provider).toBe('default');
  });

  it('should accept pixel coordinates when the provider reports them', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        modelReply(
          JSON.stringify({
            targets: ['甲'],
            items: [{ char: '甲', bbox: [10, 20, 30, 40] }],
          }),
        ),
      ),
    ) as unknown as typeof fetch;

    const service = makeService({
      ...env,
      PLATFORM_VLM_COORD_MODE: 'pixel',
    } as NodeJS.ProcessEnv);
    const result = await service.solve({
      image: PNG_DATA_URL,
      wordImage: PNG_DATA_URL,
      requiredClicks: 1,
    });

    expect(result.points).toEqual([{ x: 20, y: 30 }]);
  });

  it('should fall back to the next provider when the first one fails', async () => {
    const fetchMock = jest.fn((url: string) => {
      void url;
      return Promise.resolve(modelReply('not json at all'));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService({
      PLATFORM_VLM_PROVIDERS: 'primary,backup',
      PLATFORM_VLM_PRIMARY_BASE_URL: 'https://primary.test/v1',
      PLATFORM_VLM_PRIMARY_API_KEY: 'primary-key',
      PLATFORM_VLM_PRIMARY_MODEL: 'primary-vl',
      PLATFORM_VLM_BACKUP_BASE_URL: 'https://backup.test/v1',
      PLATFORM_VLM_BACKUP_API_KEY: 'backup-key',
      PLATFORM_VLM_BACKUP_MODEL: 'backup-vl',
    } as NodeJS.ProcessEnv);

    await expect(
      service.solve({
        image: PNG_DATA_URL,
        wordImage: PNG_DATA_URL,
        requiredClicks: 1,
      }),
    ).rejects.toThrow(/自动识别失败/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should reject results that do not cover every required click', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        modelReply(
          JSON.stringify({
            targets: ['甲', '乙'],
            items: [{ char: '甲', bbox: [100, 100, 200, 200] }],
          }),
        ),
      ),
    ) as unknown as typeof fetch;

    const service = makeService(env);
    await expect(
      service.solve({
        image: PNG_DATA_URL,
        wordImage: PNG_DATA_URL,
        requiredClicks: 2,
      }),
    ).rejects.toThrow(/自动识别失败/);
  });

  it('should accept the point answer shape models return for direct location', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(modelReply('{"char":"会","x":452,"y":520]}')),
    ) as unknown as typeof fetch;

    const service = makeService(env);
    const result = await service.solve({
      image: PNG_DATA_URL,
      wordImage: PNG_DATA_URL,
      requiredClicks: 1,
    });

    // 400x320 image, normalized 452/520 -> 181/166
    expect(result.points).toEqual([{ x: 181, y: 166 }]);
    expect(result.targets).toEqual(['会']);
  });

  it('should preset mimo defaults including disabled thinking', () => {
    const profiles = loadCaptchaProviderProfiles({
      PLATFORM_VLM_PROVIDERS: 'mimo',
      PLATFORM_VLM_MIMO_API_KEY: 'mimo-key',
    } as NodeJS.ProcessEnv);

    expect(profiles[0]).toMatchObject({
      name: 'mimo',
      baseUrl: 'https://api.xiaomimimo.com/v1',
      model: 'mimo-v2.5',
      coordinateMode: 'normalized',
      configured: true,
    });
    expect(profiles[0]?.extraBody).toEqual({
      chat_template_kwargs: { enable_thinking: false },
    });
  });

  it('should refuse to run when no provider is configured', async () => {
    const service = makeService({} as NodeJS.ProcessEnv);
    expect(service.isConfigured()).toBe(false);
    expect(service.describeProviders()[0]?.missing.length).toBeGreaterThan(0);
    await expect(
      service.solve({
        image: PNG_DATA_URL,
        wordImage: PNG_DATA_URL,
        requiredClicks: 1,
      }),
    ).rejects.toThrow(/未配置/);
  });
});
