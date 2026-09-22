import {
  Inject,
  Injectable,
  Optional,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

export type CaptchaPoint = { x: number; y: number };

export type CaptchaChallengeInput = {
  image: string;
  wordImage: string;
  requiredClicks: number;
};

export type CaptchaDetection = {
  char: string;
  bbox: [number, number, number, number];
};

export type CaptchaSolveAttempt = {
  provider: string;
  model: string;
  ok: boolean;
  detail: string;
};

export type CaptchaSolveResult = {
  points: CaptchaPoint[];
  targets: string[];
  detections: CaptchaDetection[];
  provider: string;
  model: string;
  latencyMs: number;
  attempts: CaptchaSolveAttempt[];
};

export type CoordinateMode = 'normalized' | 'pixel' | 'auto';

export type CaptchaProviderStatus = {
  name: string;
  adapter: string;
  baseUrl: string;
  model: string;
  coordinateMode: CoordinateMode;
  configured: boolean;
  missing: string[];
};

type AdapterKind = 'openai-compatible';

export const PLATFORM_CAPTCHA_PROFILES = 'PLATFORM_CAPTCHA_PROFILES';

export type CaptchaProviderProfile = {
  name: string;
  adapter: AdapterKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  coordinateMode: CoordinateMode;
  timeoutMs: number;
  jsonMode: 'none' | 'object';
  systemPrompt: string;
  userPrompt: string;
  extraHeaders: Record<string, string>;
  extraBody: Record<string, unknown>;
  configured: boolean;
  missing: string[];
};

type ImageSize = { width: number; height: number };

const NORMALIZED_MAX = 1000;
const DEFAULT_TIMEOUT_MS = 20_000;

const DEFAULT_SYSTEM_PROMPT = [
  '你是图像定位助手。用户会给你两张图片：图1是底图，图2是目标字。',
  '请找出图1中与图2相同的那个汉字，输出它的中心点坐标。',
  '坐标使用归一化整数：0 表示最左或最上，1000 表示最右或最下。',
  '',
  '只输出如下 JSON，不要输出解释、前后缀或代码块标记：',
  '{"char":"图2的字","x":500,"y":300}',
].join('\n');

const DEFAULT_USER_PROMPT =
  '图1是底图，图2是目标字。请找出图1中与图2相同的汉字并给出它的中心坐标。';

/**
 * Convenience defaults per provider name. Every field stays overridable through
 * `PLATFORM_VLM_<NAME>_*`, and any provider not listed here works by setting the
 * three required variables explicitly.
 */
const PROVIDER_PRESETS: Record<
  string,
  {
    baseUrl?: string;
    model?: string;
    coordinateMode?: CoordinateMode;
    extraBody?: Record<string, unknown>;
  }
> = {
  // Verified end-to-end against the school: mimo-v2.5 is the vision-capable model
  // (mimo-v2.5-pro accepts text only) and thinking is disabled to cut latency.
  mimo: {
    baseUrl: 'https://api.xiaomimimo.com/v1',
    model: 'mimo-v2.5',
    coordinateMode: 'normalized',
    extraBody: { chat_template_kwargs: { enable_thinking: false } },
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3-vl-flash',
    coordinateMode: 'normalized',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    coordinateMode: 'auto',
  },
  glm: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    coordinateMode: 'normalized',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    coordinateMode: 'pixel',
  },
};

@Injectable()
export class PlatformCaptchaSolverService {
  private readonly logger = new Logger(PlatformCaptchaSolverService.name);
  private readonly profiles: CaptchaProviderProfile[];

  constructor(
    @Optional()
    @Inject(PLATFORM_CAPTCHA_PROFILES)
    profiles?: CaptchaProviderProfile[],
  ) {
    this.profiles = profiles ?? loadCaptchaProviderProfiles();
    const ready = this.profiles
      .filter((profile) => profile.configured)
      .map((profile) => `${profile.name}:${profile.model}`);
    if (ready.length) {
      this.logger.log(`验证码自动识别已启用：${ready.join(' → ')}`);
    } else {
      this.logger.warn('验证码自动识别未配置，图书馆自动预约将不可用');
    }
  }

  isConfigured(): boolean {
    return this.profiles.some((profile) => profile.configured);
  }

  describeProviders(): CaptchaProviderStatus[] {
    return this.profiles.map((profile) => ({
      name: profile.name,
      adapter: profile.adapter,
      baseUrl: profile.baseUrl,
      model: profile.model,
      coordinateMode: profile.coordinateMode,
      configured: profile.configured,
      missing: profile.missing,
    }));
  }

  /**
   * Runs every configured provider in order and returns the first result that
   * resolves to a complete set of click points. Failures are collected so the
   * caller can surface which providers were tried.
   */
  async solve(input: CaptchaChallengeInput): Promise<CaptchaSolveResult> {
    const usable = this.profiles.filter((profile) => profile.configured);
    if (!usable.length) {
      throw new ServiceUnavailableException('自动识别服务未配置');
    }
    const size = imageSizeFromDataUrl(input.image);
    if (!size) {
      throw new UnprocessableEntityException('验证图片格式无法解析');
    }

    const attempts: CaptchaSolveAttempt[] = [];
    let lastDetail = '自动识别失败';
    for (const profile of usable) {
      const startedAt = Date.now();
      try {
        const raw = await this.requestModel(profile, input);
        const latencyMs = Date.now() - startedAt;
        const parsed = parseModelPayload(raw, size, profile.coordinateMode);
        const points = matchTargets(
          parsed.targets,
          parsed.detections,
          input.requiredClicks,
          size,
        );
        if (!points) {
          throw new UnprocessableEntityException(
            `识别结果无法匹配提示文字（提示 ${input.requiredClicks} 个，候选 ${parsed.detections.length} 个）`,
          );
        }
        attempts.push({
          provider: profile.name,
          model: profile.model,
          ok: true,
          detail: `${latencyMs}ms`,
        });
        return {
          points,
          targets: parsed.targets,
          detections: parsed.detections,
          provider: profile.name,
          model: profile.model,
          latencyMs,
          attempts,
        };
      } catch (error: unknown) {
        const detail = safeMessage(error);
        lastDetail = `${profile.name}: ${detail}`;
        this.logger.warn(`验证码识别失败（${profile.name}）：${detail}`);
        attempts.push({
          provider: profile.name,
          model: profile.model,
          ok: false,
          detail,
        });
      }
    }

    throw new ServiceUnavailableException(`自动识别失败：${lastDetail}`);
  }

  async recognizeText(image: string): Promise<string> {
    const usable = this.profiles.filter((profile) => profile.configured);
    if (!usable.length) {
      throw new ServiceUnavailableException('自动识别服务未配置');
    }

    for (const profile of usable) {
      try {
        const raw = await this.requestTextModel(profile, image);
        const cleaned = raw
          .replace(/```[\s\S]*?```/g, '')
          .replace(/[^0-9a-zA-Z]/g, '')
          .trim();
        if (cleaned.length >= 3 && cleaned.length <= 12) return cleaned;
      } catch (error: unknown) {
        this.logger.warn(
          `验证码文字识别失败（${profile.name}）：${safeMessage(error)}`,
        );
      }
    }

    throw new ServiceUnavailableException('验证码文字识别失败');
  }

  private async requestModel(
    profile: CaptchaProviderProfile,
    input: CaptchaChallengeInput,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: profile.model,
      temperature: 0,
      messages: [
        { role: 'system', content: profile.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: profile.userPrompt },
            { type: 'image_url', image_url: { url: input.image } },
            { type: 'image_url', image_url: { url: input.wordImage } },
          ],
        },
      ],
      ...profile.extraBody,
    };
    if (profile.jsonMode === 'object') {
      body.response_format = { type: 'json_object' };
    }

    let response: Response;
    try {
      response = await fetch(`${profile.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${profile.apiKey}`,
          ...profile.extraHeaders,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(profile.timeoutMs),
      });
    } catch (error: unknown) {
      throw new ServiceUnavailableException(`请求失败：${safeMessage(error)}`);
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      this.logger.warn(
        `${profile.name} 返回 ${response.status}：${detail.replace(/\s+/g, ' ')}`,
      );
      throw new ServiceUnavailableException(`服务返回 ${response.status}`);
    }

    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    } | null;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content;
    if (Array.isArray(content)) {
      const text = content
        .map((part) =>
          part && typeof part === 'object' && 'text' in part
            ? String((part as { text?: unknown }).text ?? '')
            : '',
        )
        .join('');
      if (text.trim()) return text;
    }
    throw new ServiceUnavailableException('服务未返回内容');
  }

  private async requestTextModel(
    profile: CaptchaProviderProfile,
    image: string,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: profile.model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            '你是验证码文字识别助手。只读取图片中的字母和数字，按从左到右输出，不要解释，不要空格，不要 Markdown。',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: '读取这张图片中的验证码。' },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
      ...profile.extraBody,
    };
    const response = await fetch(`${profile.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${profile.apiKey}`,
        ...profile.extraHeaders,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(profile.timeoutMs),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(`服务返回 ${response.status}`);
    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    } | null;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content;
    if (Array.isArray(content)) {
      const text = content
        .map((part) =>
          part && typeof part === 'object' && 'text' in part
            ? String((part as { text?: unknown }).text ?? '')
            : '',
        )
        .join('');
      if (text.trim()) return text;
    }
    throw new ServiceUnavailableException('服务未返回内容');
  }
}

export function loadCaptchaProviderProfiles(
  env: NodeJS.ProcessEnv = process.env,
): CaptchaProviderProfile[] {
  // A single JSON variable keeps arbitrary provider names deployable without
  // editing the compose file, which only forwards a fixed set of variables.
  const json = text(env.PLATFORM_VLM_PROVIDERS_JSON);
  if (json) {
    const parsed = parseProviderJson(json, env);
    if (parsed.length) return parsed;
  }
  const names = (env.PLATFORM_VLM_PROVIDERS || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length) return [buildProfile('default', env)];
  return names.map((name) => buildProfile(name, env));
}

function parseProviderJson(
  json: string,
  env: NodeJS.ProcessEnv,
): CaptchaProviderProfile[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const entries: Array<[string, unknown]> = Array.isArray(parsed)
    ? parsed.map((item, index) => [String(index), item])
    : parsed && typeof parsed === 'object'
      ? Object.entries(parsed as Record<string, unknown>)
      : [];
  const profiles: CaptchaProviderProfile[] = [];
  for (const [key, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    const config = value as Record<string, unknown>;
    const baseUrl = stringField(config.baseUrl);
    const apiKey = stringField(config.apiKey) || text(env.PLATFORM_VLM_API_KEY);
    const model = stringField(config.model);
    const missing: string[] = [];
    if (!baseUrl) missing.push('baseUrl');
    if (!apiKey) missing.push('apiKey');
    if (!model) missing.push('model');
    profiles.push({
      name: stringField(config.name) || key,
      adapter: 'openai-compatible',
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      model,
      coordinateMode: coordinateMode(stringField(config.coordinateMode)),
      timeoutMs: positiveNumber(config.timeoutMs, DEFAULT_TIMEOUT_MS),
      jsonMode: config.jsonMode === 'object' ? 'object' : 'none',
      systemPrompt: stringField(config.systemPrompt) || DEFAULT_SYSTEM_PROMPT,
      userPrompt: stringField(config.userPrompt) || DEFAULT_USER_PROMPT,
      extraHeaders: recordOfStrings(config.extraHeaders),
      extraBody:
        config.extraBody && typeof config.extraBody === 'object'
          ? (config.extraBody as Record<string, unknown>)
          : {},
      configured: missing.length === 0,
      missing,
    });
  }
  return profiles;
}

function buildProfile(
  name: string,
  env: NodeJS.ProcessEnv,
): CaptchaProviderProfile {
  const preset = PROVIDER_PRESETS[name.toLowerCase()];
  // The unnamed single-provider profile reads PLATFORM_VLM_* directly so the
  // common case needs no profile prefix.
  const prefix =
    name === 'default'
      ? 'PLATFORM_VLM_'
      : `PLATFORM_VLM_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_`;

  const baseUrl = text(env[`${prefix}BASE_URL`]) || preset?.baseUrl || '';
  const apiKey = text(env[`${prefix}API_KEY`]) || '';
  const model = text(env[`${prefix}MODEL`]) || preset?.model || '';
  const missing: string[] = [];
  if (!baseUrl) missing.push(`${prefix}BASE_URL`);
  if (!apiKey) missing.push(`${prefix}API_KEY`);
  if (!model) missing.push(`${prefix}MODEL`);

  return {
    name,
    adapter: 'openai-compatible',
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    model,
    coordinateMode: coordinateMode(
      text(env[`${prefix}COORD_MODE`]) || preset?.coordinateMode,
    ),
    timeoutMs: numberSetting(env[`${prefix}TIMEOUT_MS`], DEFAULT_TIMEOUT_MS),
    jsonMode: text(env[`${prefix}JSON_MODE`]) === 'object' ? 'object' : 'none',
    systemPrompt: text(env[`${prefix}SYSTEM_PROMPT`]) || DEFAULT_SYSTEM_PROMPT,
    userPrompt: text(env[`${prefix}USER_PROMPT`]) || DEFAULT_USER_PROMPT,
    extraHeaders: stringMap(env[`${prefix}EXTRA_HEADERS`]),
    extraBody: {
      ...(preset?.extraBody ?? {}),
      ...jsonObject(env[`${prefix}EXTRA_BODY`]),
    },
    configured: missing.length === 0,
    missing,
  };
}

function coordinateMode(value: string | undefined): CoordinateMode {
  return value === 'normalized' || value === 'pixel' || value === 'auto'
    ? value
    : 'auto';
}

/**
 * Accepts both answer shapes models actually return: a single located point
 * (`{char,x,y}`) and the annotated-box form (`{targets,items:[{char,bbox}]}`).
 */
function parseModelPayload(
  raw: string,
  size: ImageSize,
  mode: CoordinateMode,
): { targets: string[]; detections: CaptchaDetection[] } {
  const json = extractJsonObject(raw);
  if (!json) throw new UnprocessableEntityException('识别结果不是有效 JSON');
  const record = json as Record<string, unknown>;

  const detections: CaptchaDetection[] = [];

  // Point form: the model names the character and gives its centre directly.
  const pointChar = firstText(
    record.char,
    record.label,
    record.word,
    record.text,
  );
  const point = toPixelPoint(record, size, mode);
  if (pointChar && point) {
    detections.push({
      char: pointChar,
      bbox: [point.x, point.y, point.x, point.y],
    });
  }

  // Box form: list of characters with bounding boxes.
  const items = Array.isArray(record.items) ? record.items : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const char = firstText(entry.char, entry.label, entry.text, entry.word);
    if (!char) continue;
    const box = toPixelBox(
      entry.bbox ?? entry.box ?? entry.rect ?? entry.bounds,
      size,
      mode,
    );
    if (!box) continue;
    detections.push({ char, bbox: box });
  }

  const targets = Array.isArray(record.targets)
    ? record.targets
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
    : [];
  if (!targets.length && pointChar) targets.push(pointChar);

  if (!targets.length || !detections.length) {
    throw new UnprocessableEntityException('识别结果缺少目标文字或候选位置');
  }
  return { targets, detections };
}

function toPixelPoint(
  record: Record<string, unknown>,
  size: ImageSize,
  mode: CoordinateMode,
): { x: number; y: number } | null {
  const rawX = Number(record.x ?? record.px ?? record.left);
  const rawY = Number(record.y ?? record.py ?? record.top);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;

  const normalized =
    mode === 'normalized' ||
    (mode === 'auto' &&
      Math.max(rawX, rawY) > Math.max(size.width, size.height));
  const scaleX = normalized ? size.width / NORMALIZED_MAX : 1;
  const scaleY = normalized ? size.height / NORMALIZED_MAX : 1;
  return {
    x: Math.round(clamp(rawX * scaleX, 0, size.width)),
    y: Math.round(clamp(rawY * scaleY, 0, size.height)),
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const withoutFence = raw
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const fragment = withoutFence.slice(start, end + 1);

  // Models occasionally emit a stray closing bracket; try the obvious repairs
  // before giving up on the payload.
  for (const candidate of [
    fragment,
    fragment.replace(/\]\}/g, '}'),
    fragment.replace(/\]/g, ''),
  ]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next repair
    }
  }

  // Last resort: pull the fields out with a regex.
  const char = /"char"\s*:\s*"([^"]*)"/.exec(fragment)?.[1];
  const x = /"x"\s*:\s*(-?\d+(?:\.\d+)?)/.exec(fragment)?.[1];
  const y = /"y"\s*:\s*(-?\d+(?:\.\d+)?)/.exec(fragment)?.[1];
  if (x !== undefined && y !== undefined) {
    return { char: char ?? '', x: Number(x), y: Number(y) };
  }
  return null;
}

function toPixelBox(
  value: unknown,
  size: ImageSize,
  mode: CoordinateMode,
): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const values = value.slice(0, 4).map((item) => Number(item));
  if (values.some((item) => !Number.isFinite(item))) return null;

  const normalized =
    mode === 'normalized' ||
    (mode === 'auto' &&
      Math.max(...values) > Math.max(size.width, size.height));
  const scaleX = normalized ? size.width / NORMALIZED_MAX : 1;
  const scaleY = normalized ? size.height / NORMALIZED_MAX : 1;

  const [x1, y1, x2, y2] = values as [number, number, number, number];
  const box: [number, number, number, number] = [
    clamp(Math.min(x1, x2) * scaleX, 0, size.width),
    clamp(Math.min(y1, y2) * scaleY, 0, size.height),
    clamp(Math.max(x1, x2) * scaleX, 0, size.width),
    clamp(Math.max(y1, y2) * scaleY, 0, size.height),
  ];
  if (box[2] - box[0] <= 0 || box[3] - box[1] <= 0) return null;
  return box;
}

function matchTargets(
  targets: string[],
  detections: CaptchaDetection[],
  requiredClicks: number,
  size: ImageSize,
): CaptchaPoint[] | null {
  if (requiredClicks < 1 || targets.length < requiredClicks) return null;

  const byChar = new Map<string, CaptchaPoint[]>();
  for (const detection of detections) {
    const center: CaptchaPoint = {
      x: Math.round((detection.bbox[0] + detection.bbox[2]) / 2),
      y: Math.round((detection.bbox[1] + detection.bbox[3]) / 2),
    };
    if (
      center.x < 0 ||
      center.y < 0 ||
      center.x > size.width ||
      center.y > size.height
    ) {
      continue;
    }
    const bucket = byChar.get(detection.char) || [];
    bucket.push(center);
    byChar.set(detection.char, bucket);
  }

  const points: CaptchaPoint[] = [];
  const used = new Set<string>();
  for (const target of targets.slice(0, requiredClicks)) {
    const pick = (byChar.get(target) || []).find(
      (candidate) => !used.has(`${candidate.x}:${candidate.y}`),
    );
    if (!pick) return null;
    used.add(`${pick.x}:${pick.y}`);
    points.push(pick);
  }
  return points.length === requiredClicks ? points : null;
}

function text(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function jsonObject(value: string | undefined): Record<string, unknown> {
  const raw = text(value);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringMap(value: string | undefined): Record<string, string> {
  const parsed = jsonObject(value);
  return Object.fromEntries(
    Object.entries(parsed).map(([key, item]) => [key, String(item)]),
  );
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function recordOfStrings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      String(item),
    ]),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function numberSetting(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message.slice(0, 120)
    : '未知错误';
}

/**
 * Reads the pixel size straight out of the PNG/JPEG header so model output can be
 * mapped back to the coordinate space the school interface expects.
 */
export function imageSizeFromDataUrl(value: string): ImageSize | null {
  const match = /^data:image\/(?:png|jpe?g);base64,([a-zA-Z0-9+/=]+)$/.exec(
    value,
  );
  if (!match) return null;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
  return readPngSize(buffer) || readJpegSize(buffer);
}

function readPngSize(buffer: Buffer): ImageSize | null {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature))
    return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function readJpegSize(buffer: Buffer): ImageSize | null {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += 2 + length;
  }
  return null;
}
