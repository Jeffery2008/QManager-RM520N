import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkLocales, mergeTranslation, syncLocales } from "./lang.mjs";

const quietLogger = { log() {}, error() {} };
const currentDate = new Date().toISOString().slice(0, 10);

function makeTempRoot() {
  return mkdtempSync(join(tmpdir(), "qmanager-language-test-"));
}

function writeJson(path, value) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function snapshotTree(root) {
  const files = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push([path.slice(root.length + 1), readFileSync(path, "utf8")]);
    }
  }
  walk(root);
  return files.sort(([a], [b]) => a.localeCompare(b));
}

test("mergeTranslation keeps translations and reports source changes and new keys", () => {
  const context = {
    namespace: "demo",
    oldEnglish: new Map([
      ["title", "Title"],
      ["count", "Count {{n}}"],
    ]),
    newKeys: [],
    changedSources: [],
  };

  const result = mergeTranslation(
    { title: "Title", count: "Total {{n}}", added: "Added" },
    { title: "标题", count: "总数 {{n}}" },
    context,
  );

  assert.deepEqual(result, { title: "标题", count: "总数 {{n}}", added: "" });
  assert.deepEqual(context.newKeys, ["demo/added"]);
  assert.deepEqual(context.changedSources, [
    'demo/count: "Count {{n}}" -> "Total {{n}}"',
  ]);
});

test("checkLocales ignores intentionally empty English source strings", () => {
  const root = makeTempRoot();
  try {
    const englishDir = join(root, "en");
    const chineseDir = join(root, "zh-CN");
    writeJson(join(englishDir, "demo.json"), {
      empty: "",
      greeting: "Hello {{name}}",
      markup: "<strong>Hello</strong>",
    });
    writeJson(join(chineseDir, "demo.json"), {
      empty: "",
      greeting: "你好 {{name}}",
      markup: "<strong>你好</strong>",
    });

    const report = checkLocales({ englishDir, chineseDir, logger: quietLogger });
    assert.equal(report.ok, true);
    assert.equal(report.total, 2);
    assert.equal(report.translated, 2);
    assert.equal(report.missing, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkLocales catches placeholder and HTML tag mismatches", () => {
  const root = makeTempRoot();
  try {
    const englishDir = join(root, "en");
    const chineseDir = join(root, "zh-CN");
    writeJson(join(englishDir, "demo.json"), {
      greeting: "Hello {{name}}",
      markup: "<strong>Hello</strong>",
      nested: { value: "Text" },
    });
    writeJson(join(chineseDir, "demo.json"), {
      greeting: "你好",
      markup: "你好",
      nested: {},
      extra: "多余",
    });

    const report = checkLocales({ englishDir, chineseDir, logger: quietLogger });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((error) => error.includes("placeholder mismatch")));
    assert.ok(report.errors.some((error) => error.includes("HTML tag mismatch")));
    assert.ok(report.errors.some((error) => error.includes("missing Chinese key")));
    assert.ok(report.errors.some((error) => error.includes("extra Chinese key")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("syncLocales preserves translations and is idempotent", () => {
  const root = makeTempRoot();
  try {
    const localeRoot = join(root, "public", "locales");
    writeJson(join(root, "upstream.json"), {
      repository: "fixture",
      branch: "development",
      commit: "old-commit",
      version: "v1.0.0",
      synced_at: currentDate,
    });
    writeJson(join(localeRoot, "en", "demo.json"), {
      title: "Title",
      count: "Count {{n}}",
    });
    writeJson(join(localeRoot, "zh-CN", "demo.json"), {
      title: "标题",
      count: "总数 {{n}}",
    });
    writeJson(join(localeRoot, "en", "stale.json"), { old: "Old" });
    writeJson(join(localeRoot, "zh-CN", "stale.json"), { old: "旧" });

    const upstream = {
      commit: "new-commit",
      version: "v2.0.0",
      english: new Map([
        ["demo.json", { title: "Title", count: "Total {{n}}", added: "Added" }],
        ["new.json", { message: "Message" }],
      ]),
    };
    const fetcher = (repository, ref) => {
      assert.equal(repository, "fixture");
      assert.equal(ref, "development");
      return upstream;
    };

    const first = syncLocales({ root, logger: quietLogger, fetcher });
    assert.deepEqual(first.newKeys, ["demo/added", "new/message"]);
    assert.deepEqual(first.changedSources, [
      'demo/count: "Count {{n}}" -> "Total {{n}}"',
    ]);
    assert.deepEqual(readJson(join(localeRoot, "zh-CN", "demo.json")), {
      title: "标题",
      count: "总数 {{n}}",
      added: "",
    });
    assert.deepEqual(readJson(join(localeRoot, "zh-CN", "new.json")), { message: "" });
    assert.equal(readdirSync(join(localeRoot, "en")).includes("stale.json"), false);
    assert.equal(readdirSync(join(localeRoot, "zh-CN")).includes("stale.json"), false);
    assert.deepEqual(readJson(join(root, "upstream.json")), {
      repository: "fixture",
      branch: "development",
      commit: "new-commit",
      version: "v2.0.0",
      synced_at: currentDate,
    });

    const beforeSecondSync = snapshotTree(root);
    const second = syncLocales({ root, logger: quietLogger, fetcher });
    assert.deepEqual(second.newKeys, []);
    assert.deepEqual(second.changedSources, []);
    assert.deepEqual(snapshotTree(root), beforeSecondSync);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
