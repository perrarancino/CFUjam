import { unzip } from 'fflate';
import frameScript from './gameArchiveFrame.js?raw';
import storageScript from './gameArchiveStorage.js?raw';
import audioScript from '../public/game-audio.js?raw';

const maxDownload = 100 * 1024 * 1024;
const maxExtracted = 300 * 1024 * 1024;
const types = {
  html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css',
  json: 'application/json', wasm: 'application/wasm', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', ico: 'image/x-icon', ogg: 'audio/ogg', wav: 'audio/wav',
  mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm', woff: 'font/woff',
  woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf'
};

async function download(url, signal) {
  const response = await fetch(url, { signal, credentials: 'omit', cache: 'no-cache' });
  if (!response.ok || !response.body) throw new Error('Не удалось скачать ZIP со сборкой.');
  if (Number(response.headers.get('content-length')) > maxDownload) {
    await response.body.cancel();
    throw new Error('ZIP больше 100 МБ.');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxDownload) {
      await reader.cancel();
      throw new Error('ZIP больше 100 МБ.');
    }
    chunks.push(value);
  }
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

function extract(bytes, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let size = 0;
    let count = 0;
    let tooLarge = false;
    const stop = unzip(bytes, {
      filter({ name, originalSize }) {
        size += originalSize;
        count++;
        tooLarge ||= size > maxExtracted || count > 2000;
        return !tooLarge && !name.endsWith('/');
      }
    }, (error, result) => {
      signal.removeEventListener('abort', abort);
      if (tooLarge) reject(new Error('В распакованной сборке больше 300 МБ или 2000 файлов.'));
      else if (error) reject(new Error('Не удалось распаковать ZIP.'));
      else resolve(result);
    });
    function abort() {
      stop();
      reject(signal.reason);
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function loadGameArchive(url, signal, onExtract) {
  const bytes = await download(url, signal);
  signal.throwIfAborted();
  onExtract();
  const entries = await extract(bytes, signal);
  const files = Object.entries(entries).filter(([name]) =>
    !name.includes('\\') && name.split('/').every((part) => part && part !== '.' && part !== '..' && part !== '__MACOSX')
  );
  const indexes = files.map(([name]) => name).filter((name) => /(^|\/)index\.html$/i.test(name));
  const rootIndex = indexes.find((name) => !name.includes('/'));
  const entry = rootIndex || (indexes.length === 1 ? indexes[0] : null);
  if (!entry) throw new Error('В ZIP нужен index.html в корне или в одной папке сборки.');
  return {
    entry,
    files: files.map(([name, data]) => [name, new Blob([data], {
      type: types[name.split('.').pop().toLowerCase()] || 'application/octet-stream'
    })])
  };
}

export function archiveDocument(parentOrigin) {
  return '<!doctype html><html data-parent-origin="' + parentOrigin + '"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; base-uri https://cfujam-game.invalid; ' +
    'script-src \'unsafe-inline\' \'wasm-unsafe-eval\' blob:; connect-src blob: data:; worker-src blob:; ' +
    'style-src \'unsafe-inline\' blob:; img-src blob: data:; media-src blob: data:; font-src blob: data:; form-action \'none\'">' +
    '<script type="text/plain" id="cfu-audio-source">' + audioScript + '</script>' +
    '</head><body><script>' + storageScript + '\n' + frameScript + '</script></body></html>';
}
