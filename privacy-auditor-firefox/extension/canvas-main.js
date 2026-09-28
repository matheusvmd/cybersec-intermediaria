"use strict";

(() => {
  const EVENT_NAME = "privacy-auditor:page-observation";
  const INSTALL_KEY = Symbol.for("privacy-auditor.page-monitor.installed");
  const expectedReferences = [];
  const reportedReplacements = new Map();

  if (globalThis[INSTALL_KEY]) {
    return;
  }

  Object.defineProperty(globalThis, INSTALL_KEY, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

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

  function possibleScriptUrl(stack) {
    for (const line of stack) {
      const match = line.match(/https?:\/\/[^\s)]+/i);
      if (match) {
        return match[0].slice(0, 500);
      }
    }
    return "";
  }

  function emit(kind, data = {}) {
    try {
      const stack = Array.isArray(data.stack) ? data.stack : summarizeStack();
      const detail = JSON.stringify({
        kind,
        timestamp: Date.now(),
        origin: location.origin || "Origem indisponível",
        frame: window.top === window ? "principal" : "secundário",
        stack,
        scriptUrl: data.scriptUrl || possibleScriptUrl(stack),
        ...data,
      });
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
    } catch (_error) {
      // O monitor nunca deve interromper o código da página.
    }
  }

  function installMethodWrapper(prototype, method, kind, dataFactory) {
    if (!prototype) {
      return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
    if (!descriptor || typeof descriptor.value !== "function") {
      return;
    }

    const original = descriptor.value;
    const wrapped = new Proxy(original, {
      apply(target, thisArgument, argumentsList) {
        try {
          return Reflect.apply(target, thisArgument, argumentsList);
        } finally {
          emit(kind, dataFactory(method, argumentsList));
        }
      },
    });

    try {
      Object.defineProperty(prototype, method, { ...descriptor, value: wrapped });
      expectedReferences.push({
        label: `${prototype.constructor?.name || "prototype"}.${method}`,
        owner: prototype,
        property: method,
        expected: wrapped,
      });
    } catch (_error) {
      // Protótipos congelados ou páginas restritas são ignorados.
    }
  }

  function installGlobalFunctionWrapper(property, kind, dataFactory) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, property);
    if (!descriptor || typeof descriptor.value !== "function") {
      return;
    }

    const original = descriptor.value;
    const wrapped = new Proxy(original, {
      apply(target, thisArgument, argumentsList) {
        try {
          return Reflect.apply(target, thisArgument, argumentsList);
        } finally {
          emit(kind, dataFactory(argumentsList));
        }
      },
      construct(target, argumentsList, newTarget) {
        try {
          return Reflect.construct(target, argumentsList, newTarget);
        } finally {
          emit(kind, dataFactory(argumentsList));
        }
      },
    });

    try {
      Object.defineProperty(globalThis, property, { ...descriptor, value: wrapped });
      expectedReferences.push({
        label: property,
        owner: globalThis,
        property,
        expected: wrapped,
      });
    } catch (_error) {
      // Propriedades não configuráveis permanecem intocadas.
    }
  }

  function argumentUrl(value) {
    try {
      if (value && typeof value.url === "string") {
        return value.url.slice(0, 2048);
      }
      return String(value || "").slice(0, 2048);
    } catch (_error) {
      return "";
    }
  }

  installMethodWrapper(
    globalThis.HTMLCanvasElement?.prototype,
    "toDataURL",
    "canvas_read",
    (method) => ({ method })
  );
  installMethodWrapper(
    globalThis.HTMLCanvasElement?.prototype,
    "toBlob",
    "canvas_read",
    (method) => ({ method })
  );
  installMethodWrapper(
    globalThis.CanvasRenderingContext2D?.prototype,
    "getImageData",
    "canvas_read",
    (method) => ({ method })
  );
  installGlobalFunctionWrapper("fetch", "network_api_call", (args) => ({
    api: "fetch",
    url: argumentUrl(args[0]),
    method:
      args[1] && typeof args[1].method === "string"
        ? args[1].method.slice(0, 20)
        : "GET",
  }));
  installGlobalFunctionWrapper("WebSocket", "websocket", (args) => ({
    url: argumentUrl(args[0]),
  }));
  installMethodWrapper(
    globalThis.XMLHttpRequest?.prototype,
    "open",
    "network_api_call",
    (_method, args) => ({
      api: "XMLHttpRequest.open",
      method: String(args[0] || "GET").slice(0, 20),
      url: argumentUrl(args[1]),
    })
  );

  function checkIntegrity() {
    expectedReferences.forEach((reference) => {
      let current;
      try {
        current = reference.owner[reference.property];
      } catch (_error) {
        return;
      }

      if (
        current === reference.expected ||
        reportedReplacements.get(reference.label) === current
      ) {
        return;
      }

      reportedReplacements.set(reference.label, current);
      emit("hook_replaced", { target: reference.label });
    });
  }

  function reportDynamicScript(script) {
    if (!(script instanceof HTMLScriptElement)) {
      return;
    }
    emit("dynamic_script", {
      url: script.src ? script.src.slice(0, 2048) : "",
      inline: !script.src,
      module: script.type === "module",
      async: Boolean(script.async),
    });
  }

  function startScriptObserver() {
    try {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) {
              return;
            }
            reportDynamicScript(node);
            node.querySelectorAll?.("script").forEach(reportDynamicScript);
          });
        });
      });
      observer.observe(document, { childList: true, subtree: true });
    } catch (_error) {
      // MutationObserver pode estar indisponível em documentos especiais.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startScriptObserver, {
      once: true,
    });
  } else {
    startScriptObserver();
  }

  setInterval(checkIntegrity, 1000);
})();
