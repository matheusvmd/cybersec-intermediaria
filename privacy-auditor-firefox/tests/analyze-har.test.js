"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  analyzeHar,
  registrableDomain,
  renderMarkdown,
  runCli,
  safeUrl,
} = require("../scripts/analyze-har.js");

const fixturePath = path.join(__dirname, "fixtures", "sample.har");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

test("resume um HAR fictício sem modificar a entrada", () => {
  const before = JSON.stringify(fixture);
  const summary = analyzeHar(fixture, fixturePath);

  assert.equal(summary.totalRequests, 7);
  assert.equal(summary.mainDomain, "example.test");
  assert.deepEqual(summary.uniqueDomains, [
    "api.tracker.test",
    "app.example.test",
    "redirect.test",
    "socket.tracker.test",
  ]);
  assert.deepEqual(summary.possibleThirdPartyDomains, [
    "api.tracker.test",
    "redirect.test",
    "socket.tracker.test",
  ]);
  assert.equal(summary.countsByResourceType.xhr, 4);
  assert.equal(summary.responsesWithSetCookie.length, 1);
  assert.deepEqual(summary.responsesWithSetCookie[0].cookieNames, [
    "tracker_id",
  ]);
  assert.equal(summary.redirects.length, 1);
  assert.equal(summary.webSockets.length, 1);
  assert.equal(summary.identifierParameters.length, 3);
  assert.equal(summary.possiblePolling.length, 1);
  assert.equal(JSON.stringify(fixture), before);
});

test("não expõe segredos do HAR no Markdown nem no JSON", () => {
  const summary = analyzeHar(fixture, fixturePath);
  const outputs = `${renderMarkdown(summary)}\n${JSON.stringify(summary)}`;

  for (const secret of [
    "fake-identifier-12345",
    "fake-cookie-secret",
    "fake-authorization-secret",
    "fake-set-cookie-secret",
    "fake-websocket-token",
    "fake-redirect-token",
    "fake-destination-id",
  ]) {
    assert.equal(outputs.includes(secret), false, secret);
  }
  assert.match(outputs, /uid=\[mascarado:/);
  assert.match(outputs, /tracker_id/);
});

test("mascara query, credenciais e segmentos longos de URL", () => {
  const safe = safeUrl(
    "https://user:password@example.test/550e8400-e29b-41d4-a716-446655440000?token=secret-value#fragment"
  );

  assert.equal(safe.includes("user"), false);
  assert.equal(safe.includes("password"), false);
  assert.equal(safe.includes("550e8400"), false);
  assert.equal(safe.includes("secret-value"), false);
  assert.equal(safe.includes("fragment"), false);
});

test("infere domínio registrável para sufixos brasileiros comuns", () => {
  assert.equal(registrableDomain("cdn.uol.com.br"), "uol.com.br");
  assert.equal(
    registrableDomain("assets.mercadolivre.com.br"),
    "mercadolivre.com.br"
  );
});

test("rejeita estrutura que não seja um HAR", () => {
  assert.throws(() => analyzeHar({}), /HAR inválido/);
});

test("CLI cria resumos ao lado de uma cópia do HAR", (context) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "privacy-auditor-har-")
  );
  context.after(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const temporaryHar = path.join(temporaryDirectory, "sample.har");
  fs.copyFileSync(fixturePath, temporaryHar);
  const originalHar = fs.readFileSync(temporaryHar, "utf8");
  const originalWrite = process.stdout.write;
  process.stdout.write = () => true;
  let result;
  try {
    result = runCli([temporaryHar]);
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.equal(fs.existsSync(result.outputs.markdown), true);
  assert.equal(fs.existsSync(result.outputs.json), true);
  assert.equal(fs.readFileSync(temporaryHar, "utf8"), originalHar);
  assert.equal(
    fs.readFileSync(result.outputs.json, "utf8").includes("fake-cookie-secret"),
    false
  );
});
