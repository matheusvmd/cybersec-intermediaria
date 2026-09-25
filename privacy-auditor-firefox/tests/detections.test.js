"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyIdentifierParameter,
  detectBounceTracking,
  findIdentifierSharing,
  redactIdentifierParameters,
} = require("../extension/privacy-utils.js");

test("reconhece nomes de parâmetros potencialmente identificadores", () => {
  for (const name of [
    "id",
    "uid",
    "user_id",
    "userid",
    "cid",
    "client_id",
    "visitor",
    "token",
    "sync",
    "partner_id",
  ]) {
    const result = classifyIdentifierParameter(name, "abc123xyz789");
    assert.equal(result.isCandidate, true, name);
    assert.equal(result.rule, "nome identificador conhecido");
  }
});

test("reconhece valor longo opaco mesmo com nome desconhecido", () => {
  const result = classifyIdentifierParameter(
    "opaque_reference",
    "550e8400-e29b-41d4-a716-446655440000"
  );

  assert.equal(result.isCandidate, true);
  assert.equal(result.rule, "valor longo com aparência de identificador");
});

test("rejeita valores comuns, vazios, curtos e parâmetros usuais", () => {
  assert.equal(classifyIdentifierParameter("id", "1").isCandidate, false);
  assert.equal(classifyIdentifierParameter("uid", "").isCandidate, false);
  assert.equal(
    classifyIdentifierParameter("enabled", "true").isCandidate,
    false
  );
  assert.equal(
    classifyIdentifierParameter("utm_campaign", "summer-promotion-2026")
      .isCandidate,
    false
  );
});

test("remove o valor identificador da URL exposta", () => {
  const redacted = redactIdentifierParameters(
    "https://tracker.test/pixel?uid=abc123xyz789&page=2"
  );

  assert.equal(redacted.includes("abc123xyz789"), false);
  assert.equal(redacted.includes("uid="), true);
  assert.equal(redacted.includes("page=2"), true);
});

test("identifica o mesmo hash em dois domínios terceiros", () => {
  const detections = findIdentifierSharing([
    {
      hash: "hash-local-1",
      source: "query",
      domain: "tracker-a.test",
      parameterName: "uid",
    },
    {
      hash: "hash-local-1",
      source: "query",
      domain: "tracker-b.test",
      parameterName: "partner_id",
    },
  ]);

  assert.equal(detections.length, 1);
  assert.equal(
    detections[0].rule,
    "mesmo hash em domínios terceiros diferentes"
  );
  assert.deepEqual(detections[0].domains, [
    "tracker-a.test",
    "tracker-b.test",
  ]);
});

test("identifica o mesmo hash em cookie e parâmetro", () => {
  const detections = findIdentifierSharing([
    {
      hash: "hash-local-2",
      source: "cookie",
      domain: "tracker-a.test",
    },
    {
      hash: "hash-local-2",
      source: "query",
      domain: "tracker-b.test",
      parameterName: "sync",
    },
  ]);

  assert.equal(detections.length, 1);
  assert.equal(
    detections[0].rule,
    "mesmo hash em cookie e parâmetro de URL"
  );
});

test("detecta passagem rápida por intermediário com redirects automáticos", () => {
  const detections = detectBounceTracking([
    {
      fromDomain: "origem.test",
      toDomain: "intermediario.test",
      timestamp: 1000,
      automatic: true,
    },
    {
      fromDomain: "intermediario.test",
      toDomain: "destino.test",
      timestamp: 1800,
      automatic: true,
    },
  ]);

  assert.equal(detections.length, 1);
  assert.equal(detections[0].intermediateDomain, "intermediario.test");
  assert.equal(detections[0].intervalMs, 800);
});

test("não marca navegação direta ou redirects lentos", () => {
  assert.deepEqual(detectBounceTracking([]), []);
  assert.deepEqual(
    detectBounceTracking([
      {
        fromDomain: "origem.test",
        toDomain: "destino.test",
        timestamp: 1000,
        automatic: true,
      },
    ]),
    []
  );
  assert.deepEqual(
    detectBounceTracking([
      {
        fromDomain: "origem.test",
        toDomain: "intermediario.test",
        timestamp: 1000,
        automatic: true,
      },
      {
        fromDomain: "intermediario.test",
        toDomain: "destino.test",
        timestamp: 6000,
        automatic: true,
      },
    ]),
    []
  );
});
