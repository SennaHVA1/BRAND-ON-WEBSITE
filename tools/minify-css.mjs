// Minifies assets/css/style.css -> assets/css/style.min.css
// Draaien na elke wijziging aan style.css:  node tools/minify-css.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets/css/style.css');
const out = join(root, 'assets/css/style.min.css');

let css = await readFile(src, 'utf8');
css = css
  .replace(/\/\*[\s\S]*?\*\//g, '')        // comments
  .replace(/\s+/g, ' ')                    // collapse whitespace
  .replace(/\s*([{}:;,>~])\s*/g, '$1')     // space around punctuation
  .replace(/;}/g, '}')                     // trailing semicolons
  .trim();

await writeFile(out, css);
const before = (await readFile(src)).length;
console.log(`style.min.css: ${before} -> ${css.length} bytes`);
