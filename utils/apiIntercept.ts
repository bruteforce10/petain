/**
 * MAIN-world fetch/XHR interceptor. Patches window.fetch and XMLHttpRequest so
 * that responses whose URL matches one of `patterns` are forwarded to the
 * ISOLATED content script via window.postMessage.
 *
 * Must run in the page's MAIN world (see *.api.content.ts entrypoints).
 * The ISOLATED content script listens for { __terramap: true } messages.
 */

export const INTERCEPT_MSG = '__terramap_api';

export function installInterceptor(patterns: RegExp[]): void {
  const matches = (url: string) => patterns.some((p) => p.test(url));

  const emit = (url: string, body: string) => {
    try {
      window.postMessage(
        { source: INTERCEPT_MSG, url, body },
        window.location.origin,
      );
    } catch {
      /* ignore serialization errors */
    }
  };

  // --- patch fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      if (url && matches(url)) {
        res
          .clone()
          .text()
          .then((t) => emit(url, t))
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
    return res;
  };

  // --- patch XHR ---
  const OrigXHR = window.XMLHttpRequest;
  const origOpen = OrigXHR.prototype.open;
  const origSend = OrigXHR.prototype.send;

  OrigXHR.prototype.open = function (this: XMLHttpRequest, method: string, url: string) {
    (this as any).__tm_url = url;
    // eslint-disable-next-line prefer-rest-params
    return origOpen.apply(this, arguments as any);
  };

  OrigXHR.prototype.send = function (this: XMLHttpRequest, ...sendArgs: any[]) {
    this.addEventListener('load', () => {
      const url = (this as any).__tm_url as string;
      if (url && matches(url) && this.responseType === '') {
        emit(url, this.responseText);
      }
    });
    return origSend.apply(this, sendArgs as any);
  };
}
