import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const cache = process.env.SVG_RENDER_CACHE || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Caches/svg-render') : path.join(os.homedir(), '.cache/svg-render'));
export const chromeVersion = '157.0.8103.50';
export const skiaRevision = 'ca84ce0a6f1659748188469a89361ccea71e3a64';
export const emscriptenVersion = '7.0.0';
export const emscriptenRevision = '6afbd83493d647051772d491124187d4e9a0cda9';
