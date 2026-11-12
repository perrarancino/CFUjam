(() => {
  const parentOrigin = document.documentElement.dataset.parentOrigin;
  const audioScript = document.getElementById('cfu-audio-source').textContent;
  const virtualOrigin = 'https://cfujam-game.invalid';
  const report = (type) => parent.postMessage({ type }, parentOrigin);

  async function mount({ entry, files, muted }, storagePort) {
    if (storagePort) await installGameArchiveStorage(storagePort);
    const archive = new Map(files);
    const urls = new Map(files.map(([path, blob]) => [path, URL.createObjectURL(blob)]));
    const base = new URL(entry.split('/').map(encodeURIComponent).join('/'), virtualOrigin);
    const findAsset = (value, relativeTo = base) => {
      try {
        const url = new URL(value, relativeTo);
        if (url.origin === virtualOrigin) return urls.get(decodeURIComponent(url.pathname.slice(1)));
      } catch {
        // Non-URL values and external references are handled by the browser.
      }
      return undefined;
    };
    const rewriteCss = (css, relativeTo) => css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi,
      (original, double, single, plain) => {
        const asset = findAsset(double ?? single ?? plain, relativeTo);
        return asset ? 'url("' + asset + '")' : original;
      });

    for (const [path, blob] of archive) {
      if (blob.type !== 'text/css') continue;
      const cssBase = new URL(path.split('/').map(encodeURIComponent).join('/'), virtualOrigin);
      urls.set(path, URL.createObjectURL(new Blob([rewriteCss(await blob.text(), cssBase)], { type: 'text/css' })));
    }

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const asset = findAsset(input instanceof Request ? input.url : input);
      if (!asset) return nativeFetch(input, init);
      return nativeFetch(input instanceof Request ? new Request(asset, input) : asset, init);
    };
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...options) {
      return open.call(this, method, findAsset(url) || url, ...options);
    };
    if (window.Worker) {
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(url, options) { super(findAsset(url) || url, options); }
      };
    }
    const worklet = window.Worklet?.prototype || window.AudioWorklet?.prototype;
    if (worklet?.addModule) {
      const addModule = worklet.addModule;
      worklet.addModule = function (url, options) {
        return addModule.call(this, findAsset(url) || url, options);
      };
    }

    const page = new DOMParser().parseFromString(await archive.get(entry).text(), 'text/html');
    page.querySelectorAll('base, meta[http-equiv="refresh" i]').forEach((node) => node.remove());
    page.querySelectorAll('[src], link[href], video[poster], [style], style').forEach((node) => {
      for (const attr of ['src', 'href', 'poster']) {
        const value = node.getAttribute(attr);
        const asset = value && findAsset(value);
        if (asset) node.setAttribute(attr, asset);
      }
      if (node.hasAttribute('style')) node.setAttribute('style', rewriteCss(node.getAttribute('style'), base));
      if (node.localName === 'style') node.textContent = rewriteCss(node.textContent, base);
    });
    const baseElement = page.createElement('base');
    baseElement.href = base.href;
    const audio = page.createElement('script');
    audio.dataset.parentOrigin = parentOrigin;
    audio.dataset.muted = String(muted);
    audio.textContent = audioScript;
    page.head.prepend(baseElement, audio);

    document.open();
    window.addEventListener('load', () => report('cfujam:archive-mounted'), { once: true });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') report('cfujam:escape');
    });
    document.write('<!doctype html>' + page.documentElement.outerHTML);
    document.close();
  }

  function receive(event) {
    if (event.source !== parent || event.origin !== parentOrigin || event.data?.type !== 'cfujam:run-archive') return;
    window.removeEventListener('message', receive);
    mount(event.data, event.ports[0]).catch((error) => {
      console.error(error);
      report('cfujam:archive-error');
    });
  }
  window.addEventListener('message', receive);
})();
