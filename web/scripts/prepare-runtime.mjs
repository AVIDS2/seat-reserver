import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const standalone = resolve(root, '.next', 'standalone');
const runtime = resolve(root, 'runtime');

await rm(runtime, { recursive: true, force: true });
await mkdir(runtime, { recursive: true });
await cp(standalone, runtime, { recursive: true });
await cp(resolve(root, '.next', 'static'), resolve(runtime, '.next', 'static'), { recursive: true });
await cp(resolve(root, 'public'), resolve(runtime, 'public'), { recursive: true });
console.log(`Prepared standalone runtime at ${runtime}`);
