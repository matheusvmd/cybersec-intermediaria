"use strict";

(() => {
  const EVENT_NAME = "privacy-auditor:canvas-read";
  const INSTALL_KEY = Symbol.for("privacy-auditor.canvas-monitor.installed");
  const ALLOWED_METHODS = new Set(["toDataURL", "toBlob", "getImageData"]);

  if (globalThis[INSTALL_KEY]) {
    return;
  }

  Object.defineProperty(globalThis, INSTALL_KEY, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  function safeScriptUrl(stackLines) {
    for (const line of stackLines) {
      const match = line.match(/https?:\/\/[^\s)]+/i);
      if (!match) {
        continue;
      }

      try {
        const url = new URL(match[0]);
        return `${url.origin}${url.pathname}`.slice(0, 500);
      } catch (_error) {
        // Continua procurando uma URL válida em outra linha.
      }
    }

    return "";
  }

  function summarizeStack() {
    try {
      return String(new Error().stack || "")
        .split("\n")
        .slice(2, 8)
        .map((line) =>
          line
            .trim()
            .replace(/(https?:\/\/[^\s?#)]+)[^\s)]*/gi, "$1")
            .slice(0, 300)
        )
        .filter(Boolean);
    } catch (_error) {
      return [];
    }
  }

  function reportRead(method) {
    if (!ALLOWED_METHODS.has(method)) {
      return;
    }

    const stack = summarizeStack();
    const payload = {
      method,
      timestamp: Date.now(),
      origin: location.origin || "Origem indisponível",
      frame: window.top === window ? "principal" : "secundário",
      stack,
      scriptUrl: safeScriptUrl(stack),
    };

    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: JSON.stringify(payload),
      })
    );
  }

  function wrapMethod(prototype, method) {
    if (!prototype) {
      return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
    if (!descriptor || typeof descriptor.value !== "function") {
      return;
    }

    const original = descriptor.value;
    const wrapped = function monitoredCanvasRead(...args) {
      try {
        return Reflect.apply(original, this, args);
      } finally {
        reportRead(method);
      }
    };

    try {
      Object.defineProperty(prototype, method, {
        ...descriptor,
        value: wrapped,
      });
    } catch (_error) {
      // Algumas páginas podem congelar protótipos antes da instalação.
    }
  }

  wrapMethod(globalThis.HTMLCanvasElement?.prototype, "toDataURL");
  wrapMethod(globalThis.HTMLCanvasElement?.prototype, "toBlob");
  wrapMethod(globalThis.CanvasRenderingContext2D?.prototype, "getImageData");
})();

