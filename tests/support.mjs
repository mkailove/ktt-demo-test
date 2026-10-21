import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadCore() {
  let html;
  try {
    html = readFileSync(resolve(root, 'index.html'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  const script = html.match(/<script id="app-script">([\s\S]*?)<\/script>/)?.[1];
  if (!script) return {};
  return vm.runInNewContext(`${script}\napp.core`, {
    console,
    URL,
    setTimeout,
    clearTimeout,
  });
}
