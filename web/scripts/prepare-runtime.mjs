import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const standalone = resolve(root, '.next', 'standalone');
const runtime = resolve(root, 'runtime');

await rm(runtime, { recursive: true, force: true });
await mkdir(runtime, { recursive: true });
await cp(standalone, runtime, { recursive: true });
await cp(resolve(root, '.next', 'static'), resolve(runtime, '.next', 'static'), { recursive: true });
await cp(resolve(root, 'public'), resolve(runtime, 'public'), { recursive: true });

// Turbopack can externalize OpenTelemetry packages under build-specific names.
// Keep small runtime aliases so standalone output works without the full source tree.
const runtimeNodeModules = resolve(runtime, 'node_modules');
const externalAliases = new Map();

async function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJavaScriptFiles(path)));
    else if (entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

for (const file of await collectJavaScriptFiles(resolve(runtime, '.next', 'server'))) {
  const source = await readFile(file, 'utf8');
  const matches = source.matchAll(
    /(?:require|import)\(["']((?:require|import)-in-the-middle)-([a-f0-9]+)["']\)/g
  );
  for (const match of matches) {
    externalAliases.set(`${match[1]}-${match[2]}`, match[1]);
  }
}

for (const [alias, target] of externalAliases) {
  const aliasDirectory = resolve(runtimeNodeModules, alias);
  await mkdir(aliasDirectory, { recursive: true });
  await writeFile(
    resolve(aliasDirectory, 'index.js'),
    `module.exports = require(${JSON.stringify(target)});\n`,
    'utf8'
  );
  await writeFile(
    resolve(aliasDirectory, 'package.json'),
    JSON.stringify({ name: alias, private: true, main: 'index.js' }) + '\n',
    'utf8'
  );
}

console.log(`Prepared standalone runtime at ${runtime} (${externalAliases.size} external aliases)`);
