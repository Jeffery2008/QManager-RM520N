#!/usr/bin/env node

import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = join(ROOT, "public", "locales");
const EN_DIR = join(LOCALES, "en");
const ZH_DIR = join(LOCALES, "zh-CN");
const DEFAULT_UPSTREAM = "https://github.com/dr-dolomite/QManager-RM520N.git";
const NAMESPACE_FILE = /^[a-z0-9][a-z0-9-]*\.json$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listNamespaceFiles(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && NAMESPACE_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectLeaves(node, prefix = "", out = new Map()) {
  if (typeof node === "string") {
    out.set(prefix, { kind: "string", value: node });
    return out;
  }
  if (Array.isArray(node)) {
    out.set(prefix, { kind: "array", value: JSON.stringify(node) });
    return out;
  }
  if (isRecord(node)) {
    for (const [key, value] of Object.entries(node)) {
      collectLeaves(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  throw new TypeError(`unsupported JSON value at ${prefix || "root"}`);
}

export function flattenStrings(node, prefix = "", out = new Map()) {
  for (const [key, leaf] of collectLeaves(node, prefix)) {
    if (leaf.kind === "string") out.set(key, leaf.value);
  }
  return out;
}

function countTokens(value, regexp, normalize) {
  const counts = new Map();
  for (const match of value.matchAll(regexp)) {
    const token = normalize(match);
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function compareCounts(expected, actual) {
  const missing = [];
  const extra = [];
  for (const [token, count] of expected) {
    const actualCount = actual.get(token) ?? 0;
    for (let i = actualCount; i < count; i += 1) missing.push(token);
  }
  for (const [token, count] of actual) {
    const expectedCount = expected.get(token) ?? 0;
    for (let i = expectedCount; i < count; i += 1) extra.push(token);
  }
  return { missing, extra };
}

function validateNamespace(namespace, english, chinese, errors, stats) {
  if (!isRecord(english) || !isRecord(chinese)) {
    errors.push(`${namespace}: namespace root must be a JSON object`);
    return;
  }

  let englishLeaves;
  let chineseLeaves;
  try {
    englishLeaves = collectLeaves(english);
    chineseLeaves = collectLeaves(chinese);
  } catch (error) {
    errors.push(`${namespace}: ${error.message}`);
    return;
  }

  stats.total += [...englishLeaves.values()].filter(
    (leaf) => leaf.kind === "string" && leaf.value.trim() !== "",
  ).length;

  for (const [key, englishLeaf] of englishLeaves) {
    const chineseLeaf = chineseLeaves.get(key);
    if (!chineseLeaf) {
      errors.push(`${namespace}/${key}: missing Chinese key`);
      continue;
    }
    if (chineseLeaf.kind !== englishLeaf.kind) {
      errors.push(`${namespace}/${key}: value type differs from English`);
      continue;
    }
    if (englishLeaf.kind !== "string") continue;

    const chineseValue = chineseLeaf.value;
    if (chineseValue.trim() === "") {
      if (englishLeaf.value.trim() !== "") stats.missing += 1;
      continue;
    }
    stats.translated += 1;

    const englishPlaceholders = countTokens(
      englishLeaf.value,
      /\{\{\s*([^}]+?)\s*\}\}/g,
      (match) => match[1].split(",")[0].trim(),
    );
    const chinesePlaceholders = countTokens(
      chineseValue,
      /\{\{\s*([^}]+?)\s*\}\}/g,
      (match) => match[1].split(",")[0].trim(),
    );
    const placeholderDiff = compareCounts(englishPlaceholders, chinesePlaceholders);
    if (placeholderDiff.missing.length || placeholderDiff.extra.length) {
      errors.push(
        `${namespace}/${key}: placeholder mismatch (missing: ${placeholderDiff.missing.join(", ") || "none"}; extra: ${placeholderDiff.extra.join(", ") || "none"})`,
      );
    }

    const englishTags = countTokens(
      englishLeaf.value,
      /<\/?[a-zA-Z][^>]*>/g,
      (match) => match[0].toLowerCase().replace(/\s+/g, " "),
    );
    const chineseTags = countTokens(
      chineseValue,
      /<\/?[a-zA-Z][^>]*>/g,
      (match) => match[0].toLowerCase().replace(/\s+/g, " "),
    );
    const tagDiff = compareCounts(englishTags, chineseTags);
    if (tagDiff.missing.length || tagDiff.extra.length) {
      errors.push(
        `${namespace}/${key}: HTML tag mismatch (missing: ${tagDiff.missing.join(", ") || "none"}; extra: ${tagDiff.extra.join(", ") || "none"})`,
      );
    }
  }

  for (const key of chineseLeaves.keys()) {
    if (!englishLeaves.has(key)) errors.push(`${namespace}/${key}: extra Chinese key`);
  }
}

export function checkLocales({ englishDir = EN_DIR, chineseDir = ZH_DIR, logger = console } = {}) {
  const errors = [];
  const stats = { total: 0, translated: 0, missing: 0 };
  const englishFiles = listNamespaceFiles(englishDir);
  const chineseFiles = listNamespaceFiles(chineseDir);

  if (!englishFiles.length) errors.push("no English namespace JSON files found");

  for (const filename of englishFiles) {
    const namespace = filename.slice(0, -5);
    const englishPath = join(englishDir, filename);
    const chinesePath = join(chineseDir, filename);
    let english;
    let chinese;
    try {
      english = readJson(englishPath);
    } catch (error) {
      errors.push(`${englishPath}: invalid JSON (${error.message})`);
      continue;
    }
    try {
      chinese = readJson(chinesePath);
    } catch (error) {
      errors.push(`${chinesePath}: invalid or missing JSON (${error.message})`);
      continue;
    }
    validateNamespace(namespace, english, chinese, errors, stats);
  }

  for (const filename of chineseFiles) {
    if (!englishFiles.includes(filename)) {
      errors.push(`${filename}: Chinese namespace does not exist in English`);
    }
  }

  const percentage = stats.total === 0 ? "0.00" : ((stats.translated / stats.total) * 100).toFixed(2);
  logger.log(`zh-CN: ${stats.translated}/${stats.total} translated (${percentage}%), ${stats.missing} untranslated`);
  for (const error of errors) logger.error(`- ${error}`);
  logger.log(errors.length ? `FAIL: ${errors.length} structural error(s)` : "PASS: locale structure is valid");
  return { ok: errors.length === 0, errors, ...stats };
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  }
  return result.stdout;
}

function fetchUpstream(repository, ref) {
  const temp = mkdtempSync(join(tmpdir(), "qmanager-upstream-"));
  try {
    runGit(["init", "-q"], temp);
    runGit(["remote", "add", "origin", repository], temp);
    runGit(["fetch", "--depth=1", "--tags", "origin", ref], temp);
    const commit = runGit(["rev-parse", "FETCH_HEAD"], temp).trim();
    const paths = runGit(["ls-tree", "-r", "--name-only", "FETCH_HEAD", "--", "public/locales/en"], temp)
      .split(/\r?\n/)
      .map((path) => path.trim())
      .filter(Boolean)
      .map((path) => path.slice("public/locales/en/".length))
      .filter((filename) => NAMESPACE_FILE.test(filename));
    if (!paths.length) throw new Error("upstream has no public/locales/en/*.json files");

    const english = new Map();
    for (const filename of paths.sort()) {
      const raw = runGit(["show", `FETCH_HEAD:public/locales/en/${filename}`], temp);
      try {
        english.set(filename, JSON.parse(raw));
      } catch (error) {
        throw new Error(`upstream ${filename} is invalid JSON: ${error.message}`);
      }
    }

    let version = ref;
    try {
      const tags = runGit(["tag", "--points-at", "FETCH_HEAD"], temp).trim().split(/\s+/).filter(Boolean);
      if (tags.length) version = tags.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
    } catch {
      // A branch checkout may not include tags; the commit remains authoritative.
    }
    return { commit, version, english };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function blankLike(value) {
  if (typeof value === "string") return "";
  if (Array.isArray(value)) return value.map(blankLike);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, blankLike(child)]));
  return value;
}

export function mergeTranslation(english, previous, context, path = "") {
  if (typeof english === "string") {
    const oldEnglish = context.oldEnglish?.get(path);
    if (oldEnglish !== undefined && oldEnglish !== english) {
      context.changedSources.push(`${context.namespace}/${path}: ${JSON.stringify(oldEnglish)} -> ${JSON.stringify(english)}`);
    }
    if (oldEnglish === undefined) context.newKeys.push(`${context.namespace}/${path}`);
    return typeof previous === "string" ? previous : "";
  }
  if (Array.isArray(english)) return previous ?? blankLike(english);
  if (!isRecord(english)) return previous ?? english;

  const previousObject = isRecord(previous) ? previous : {};
  const output = {};
  for (const [key, value] of Object.entries(english)) {
    const childPath = path ? `${path}.${key}` : key;
    output[key] = mergeTranslation(value, previousObject[key], context, childPath);
  }
  return output;
}

function loadLocalEnglish(englishDir) {
  const result = new Map();
  for (const filename of listNamespaceFiles(englishDir)) {
    try {
      result.set(filename, readJson(join(englishDir, filename)));
    } catch {
      // The sync writes the fetched source over malformed local baselines.
    }
  }
  return result;
}

function formatDate() {
  return new Date().toISOString().slice(0, 10);
}

export function syncLocales({ root = ROOT, ref = "development", logger = console, fetcher = fetchUpstream } = {}) {
  const configPath = join(root, "upstream.json");
  const config = existsSync(configPath) ? readJson(configPath) : {};
  const repository = config.repository || DEFAULT_UPSTREAM;
  const upstream = fetcher(repository, ref);
  const englishDir = join(root, "public", "locales", "en");
  const chineseDir = join(root, "public", "locales", "zh-CN");
  const oldEnglish = loadLocalEnglish(englishDir);
  const newKeys = [];
  const changedSources = [];

  mkdirSync(englishDir, { recursive: true });
  mkdirSync(chineseDir, { recursive: true });

  for (const [filename, english] of upstream.english) {
    const namespace = filename.slice(0, -5);
    const englishPath = join(englishDir, filename);
    const chinesePath = join(chineseDir, filename);
    const previousChinese = existsSync(chinesePath) ? readJson(chinesePath) : {};
    const oldEnglishLeaves = oldEnglish.has(filename) ? flattenStrings(oldEnglish.get(filename)) : new Map();
    const mergedChinese = mergeTranslation(english, previousChinese, {
      namespace,
      oldEnglish: oldEnglishLeaves,
      newKeys,
      changedSources,
    });
    writeJson(englishPath, english);
    writeJson(chinesePath, mergedChinese);
  }

  const upstreamFiles = new Set(upstream.english.keys());
  for (const directory of [englishDir, chineseDir]) {
    for (const filename of listNamespaceFiles(directory)) {
      if (!upstreamFiles.has(filename)) rmSync(join(directory, filename));
    }
  }

  const nextConfig = {
    repository,
    branch: ref,
    commit: upstream.commit,
    version: upstream.version,
    synced_at: config.commit === upstream.commit ? (config.synced_at || formatDate()) : formatDate(),
  };
  writeJson(configPath, nextConfig);

  logger.log(`Synced ${upstream.english.size} namespaces from ${upstream.version} (${upstream.commit}).`);
  if (newKeys.length) {
    logger.log(`New keys left untranslated (${newKeys.length}):\n${newKeys.map((key) => `  - ${key}`).join("\n")}`);
  }
  if (changedSources.length) {
    logger.log(`English source changed; review these translations (${changedSources.length}):\n${changedSources.map((line) => `  - ${line}`).join("\n")}`);
  }

  const report = checkLocales({ englishDir, chineseDir, logger });
  if (!report.ok) throw new Error("sync produced an invalid locale tree");
  return { ...upstream, newKeys, changedSources, report };
}

async function main() {
  const command = process.argv[2];
  if (command === "check") {
    const report = checkLocales();
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (command === "sync") {
    try {
      syncLocales({ ref: process.argv[3] || "development" });
    } catch (error) {
      console.error(`ERROR: ${error.message}`);
      process.exitCode = 1;
    }
    return;
  }
  console.log("Usage: npm run language:check | npm run language:sync [upstream-branch]");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}