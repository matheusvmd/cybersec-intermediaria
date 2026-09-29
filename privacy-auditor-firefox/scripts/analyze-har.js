#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  classifyIdentifierParameter,
  detectPersistentPolling,
  isIpAddress,
  normalizeHostname,
} = require("../extension/privacy-utils.js");

const COMPOUND_PUBLIC_SUFFIXES = new Set([
  "com.br",
  "net.br",
  "org.br",
  "gov.br",
  "co.uk",
  "org.uk",
  "com.au",
  "co.jp",
]);

function registrableDomain(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized || normalized === "localhost" || isIpAddress(normalized)) {
    return normalized;
  }

  const labels = normalized.split(".");
  const suffix = labels.slice(-2).join(".");
  if (COMPOUND_PUBLIC_SUFFIXES.has(suffix) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return labels.length >= 2 ? labels.slice(-2).join(".") : normalized;
}

function maskValue(value) {
  return `[mascarado:${String(value || "").length}]`;
}

function maskPath(pathname) {
  return pathname
    .split("/")
    .map((segment) => {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch (_error) {
        // Mantém o segmento codificado se ele for inválido.
      }
      return decoded.length >= 16 && new Set(decoded.toLowerCase()).size >= 4
        ? "[segmento-mascarado]"
        : segment;
    })
    .join("/");
}

function safeUrl(rawUrl, baseUrl) {
  try {
    const url = new URL(String(rawUrl || ""), baseUrl || undefined);
    const maskedParameters = new URLSearchParams();
    url.searchParams.forEach((value, name) => {
      maskedParameters.append(name, maskValue(value));
    });
    url.username = "";
    url.password = "";
    url.pathname = maskPath(url.pathname);
    url.search = maskedParameters.toString();
    url.hash = "";
    return url.href;
  } catch (_error) {
    return "URL inválida ou indisponível";
  }
}

function parseUrl(rawUrl, baseUrl) {
  try {
    return new URL(String(rawUrl || ""), baseUrl || undefined);
  } catch (_error) {
    return null;
  }
}

function headerValues(headers, targetName) {
  const expected = targetName.toLowerCase();
  return (Array.isArray(headers) ? headers : [])
    .filter(
      (header) =>
        header && String(header.name || "").toLowerCase() === expected
    )
    .map((header) => String(header.value || ""));
}

function setCookieName(headerValue) {
  const firstPair = String(headerValue || "").split(";", 1)[0];
  const separator = firstPair.indexOf("=");
  if (separator <= 0) {
    return "(nome indisponível)";
  }
  const name = firstPair.slice(0, separator).trim().slice(0, 120);
  return name || "(nome indisponível)";
}

function resourceType(entry) {
  if (typeof entry?._resourceType === "string" && entry._resourceType) {
    return entry._resourceType;
  }

  const mime = String(entry?.response?.content?.mimeType || "").toLowerCase();
  if (mime.includes("html")) return "document";
  if (mime.includes("javascript")) return "script";
  if (mime.includes("css")) return "stylesheet";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("font/")) return "font";
  if (mime.includes("json")) return "json";
  return "other";
}

function findMainUrl(har, entries) {
  const pages = Array.isArray(har?.log?.pages) ? har.log.pages : [];
  for (const page of pages) {
    if (parseUrl(page && page.title)) {
      return page.title;
    }
  }

  const documentEntry = entries.find(
    (entry) => resourceType(entry) === "document" && parseUrl(entry?.request?.url)
  );
  return documentEntry?.request?.url || entries[0]?.request?.url || "";
}

function analyzeHar(har, sourceFile = "arquivo.har") {
  if (!har || !har.log || !Array.isArray(har.log.entries)) {
    throw new Error("HAR inválido: log.entries não foi encontrado.");
  }

  const entries = har.log.entries;
  const mainUrl = findMainUrl(har, entries);
  const parsedMainUrl = parseUrl(mainUrl);
  const mainDomain = parsedMainUrl
    ? registrableDomain(parsedMainUrl.hostname)
    : "";
  const domains = new Set();
  const requestsByDomain = new Map();
  const countsByResourceType = new Map();
  const responsesWithSetCookie = [];
  const redirects = [];
  const webSockets = [];
  const identifierParameters = [];
  const identifierKeys = new Set();
  const pollingGroups = new Map();

  entries.forEach((entry) => {
    const request = entry && entry.request ? entry.request : {};
    const response = entry && entry.response ? entry.response : {};
    const parsedUrl = parseUrl(request.url);
    if (!parsedUrl) {
      return;
    }

    const hostname = normalizeHostname(parsedUrl.hostname);
    const domain = registrableDomain(hostname);
    if (hostname) {
      domains.add(hostname);
      requestsByDomain.set(hostname, (requestsByDomain.get(hostname) || 0) + 1);
    }

    const type = resourceType(entry);
    countsByResourceType.set(type, (countsByResourceType.get(type) || 0) + 1);

    const setCookieHeaders = headerValues(response.headers, "set-cookie");
    if (setCookieHeaders.length > 0) {
      responsesWithSetCookie.push({
        domain: hostname,
        url: safeUrl(parsedUrl.href),
        status: Number(response.status) || 0,
        headerCount: setCookieHeaders.length,
        cookieNames: setCookieHeaders.map(setCookieName),
      });
    }

    const status = Number(response.status) || 0;
    const redirectLocations = headerValues(response.headers, "location");
    const redirectTarget = response.redirectURL || redirectLocations[0] || "";
    if (status >= 300 && status < 400 && redirectTarget) {
      const parsedTarget = parseUrl(redirectTarget, parsedUrl.href);
      redirects.push({
        status,
        from: safeUrl(parsedUrl.href),
        fromDomain: domain,
        to: safeUrl(redirectTarget, parsedUrl.href),
        toDomain: parsedTarget ? registrableDomain(parsedTarget.hostname) : "",
      });
    }

    if (
      ["ws:", "wss:"].includes(parsedUrl.protocol) ||
      type === "websocket" ||
      status === 101
    ) {
      webSockets.push({
        domain: hostname,
        url: safeUrl(parsedUrl.href),
        status,
      });
    }

    parsedUrl.searchParams.forEach((value, name) => {
      const classification = classifyIdentifierParameter(name, value);
      if (!classification.isCandidate) {
        return;
      }
      const key = `${hostname}\n${classification.parameterName}\n${classification.rule}`;
      if (identifierKeys.has(key)) {
        return;
      }
      identifierKeys.add(key);
      identifierParameters.push({
        domain: hostname,
        endpoint: `${parsedUrl.origin}${maskPath(parsedUrl.pathname)}`,
        name: classification.parameterName,
        maskedValue: maskValue(value),
        rule: classification.rule,
      });
    });

    const timestamp = Date.parse(entry.startedDateTime);
    if (Number.isFinite(timestamp)) {
      const method = String(request.method || "GET").toUpperCase();
      const endpoint = `${parsedUrl.origin}${parsedUrl.pathname}`;
      const key = `${method}\n${endpoint}`;
      const events = pollingGroups.get(key) || [];
      events.push({ timestamp, method, endpoint, domain: hostname });
      pollingGroups.set(key, events);
    }
  });

  const possiblePolling = [];
  pollingGroups.forEach((events) => {
    const detection = detectPersistentPolling(events);
    if (detection.detected) {
      possiblePolling.push({
        domain: events[0].domain,
        method: events[0].method,
        endpoint: safeUrl(events[0].endpoint),
        callCount: detection.callCount,
        averageIntervalMs: detection.averageIntervalMs,
        justification: detection.justification,
      });
    }
  });

  const uniqueDomains = [...domains].sort();
  const possibleThirdPartyDomains = uniqueDomains.filter(
    (hostname) => mainDomain && registrableDomain(hostname) !== mainDomain
  );

  return {
    sourceFile: path.basename(sourceFile),
    disclaimer:
      "Resultados heurísticos; confirme cada item no HAR original e nas demais evidências.",
    totalRequests: entries.length,
    mainDomain: mainDomain || "indisponível",
    uniqueDomains,
    possibleThirdPartyDomains,
    countsByResourceType: Object.fromEntries(
      [...countsByResourceType.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
    responsesWithSetCookie,
    redirects,
    webSockets,
    identifierParameters,
    requestsByDomain: [...requestsByDomain.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([domain, count]) => ({ domain, count })),
    possiblePolling,
  };
}

function markdownText(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function markdownList(values, emptyMessage = "Nenhum item observado.") {
  return values.length > 0
    ? values.map((value) => `- ${markdownText(value)}`).join("\n")
    : `- ${emptyMessage}`;
}

function renderMarkdown(summary) {
  const resourceRows = Object.entries(summary.countsByResourceType)
    .map(([type, count]) => `| ${markdownText(type)} | ${count} |`)
    .join("\n");
  const domainRows = summary.requestsByDomain
    .map((item) => `| ${markdownText(item.domain)} | ${item.count} |`)
    .join("\n");

  return `# Resumo heurístico do HAR

- Arquivo: ${markdownText(summary.sourceFile)}
- Total de requisições: ${summary.totalRequests}
- Domínio principal inferido: ${markdownText(summary.mainDomain)}
- Aviso: ${markdownText(summary.disclaimer)}

## Domínios únicos

${markdownList(summary.uniqueDomains)}

## Possíveis domínios de terceiros

${markdownList(summary.possibleThirdPartyDomains)}

## Contagem por tipo de recurso

| Tipo | Quantidade |
| --- | ---: |
${resourceRows || "| PENDENTE | 0 |"}

## Requisições por domínio

| Domínio | Quantidade |
| --- | ---: |
${domainRows || "| PENDENTE | 0 |"}

## Respostas com Set-Cookie

${markdownList(
  summary.responsesWithSetCookie.map(
    (item) =>
      `${item.domain} — status ${item.status}; ${item.headerCount} cabeçalho(s); nomes: ${item.cookieNames.join(", ")}; URL: ${item.url}`
  )
)}

## Redirecionamentos HTTP

${markdownList(
  summary.redirects.map(
    (item) => `${item.status}: ${item.from} → ${item.to}`
  )
)}

## WebSockets

${markdownList(
  summary.webSockets.map(
    (item) => `${item.domain} — status ${item.status}; ${item.url}`
  )
)}

## Parâmetros potencialmente identificadores

${markdownList(
  summary.identifierParameters.map(
    (item) =>
      `${item.domain} — ${item.name}=${item.maskedValue}; regra: ${item.rule}; endpoint: ${item.endpoint}`
  )
)}

## Possíveis padrões de polling

${markdownList(
  summary.possiblePolling.map(
    (item) =>
      `${item.method} ${item.endpoint} — ${item.callCount} chamadas; intervalo médio ${item.averageIntervalMs} ms; ${item.justification}`
  )
)}

Nenhum valor de Cookie, Set-Cookie, Authorization, token ou identificador é
incluído neste resumo. Consulte o HAR original localmente para a reconciliação.
`;
}

function outputPaths(harPath) {
  const parsed = path.parse(harPath);
  const base = path.join(parsed.dir, parsed.name);
  return {
    markdown: `${base}.summary.md`,
    json: `${base}.summary.json`,
  };
}

function runCli(args) {
  if (args.length !== 1) {
    throw new Error("Uso: node scripts/analyze-har.js caminho/arquivo.har");
  }

  const harPath = path.resolve(args[0]);
  const raw = fs.readFileSync(harPath, "utf8");
  const har = JSON.parse(raw);
  const summary = analyzeHar(har, harPath);
  const markdown = renderMarkdown(summary);
  const outputs = outputPaths(harPath);
  fs.writeFileSync(outputs.markdown, markdown, { encoding: "utf8", flag: "w" });
  fs.writeFileSync(outputs.json, `${JSON.stringify(summary, null, 2)}\n`, {
    encoding: "utf8",
    flag: "w",
  });
  process.stdout.write(
    `${markdown}\nArquivos gerados:\n- ${outputs.markdown}\n- ${outputs.json}\n`
  );
  return { summary, outputs };
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Erro: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  analyzeHar,
  maskValue,
  outputPaths,
  registrableDomain,
  renderMarkdown,
  runCli,
  safeUrl,
};
