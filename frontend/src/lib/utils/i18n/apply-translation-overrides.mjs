#!/usr/bin/env node
/**
 * Apply manual translation overrides where a locale still matches English.
 * Usage: node apply-translation-overrides.mjs [locale codes...]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OVERRIDES_DIR = path.join(__dirname, 'overrides');

const KEY_VALUE_LINE = /^(\s*'([^']+)':\s*)(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")(\s*,?\s*)$/;

function parseValues(content) {
  const map = {};
  const re = /^\s*'([^']+)':\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*,?\s*$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    const raw = match[2];
    const quote = raw.trim().slice(0, 1);
    const inner = raw.trim().slice(1, -1);
    map[match[1]] =
      quote === "'"
        ? inner.replace(/\\'/g, "'").replace(/\\\\/g, '\\')
        : inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return map;
}

function escapeForSingleQuote(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function applyOverrides(localeCode, overrides, enMap) {
  const filePath = path.join(__dirname, `${localeCode}.ts`);
  const content = fs.readFileSync(filePath, 'utf8');
  const localeMap = parseValues(content);
  const lines = content.split('\n');
  let applied = 0;
  let skipped = 0;

  const out = lines.map((line) => {
    const match = line.match(KEY_VALUE_LINE);
    if (!match) return line;

    const key = match[2];
    const override = overrides[key];
    if (override === undefined) return line;

    if (localeMap[key] !== enMap[key]) {
      skipped += 1;
      return line;
    }

    applied += 1;
    return `${match[1]}'${escapeForSingleQuote(override)}'${match[3]}`;
  });

  fs.writeFileSync(filePath, out.join('\n'), 'utf8');
  return { applied, skipped };
}

function main() {
  const enMap = parseValues(fs.readFileSync(path.join(__dirname, 'en.ts'), 'utf8'));
  const locales = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs
        .readdirSync(OVERRIDES_DIR)
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.replace(/\.json$/, ''));

  for (const localeCode of locales) {
    const overridePath = path.join(OVERRIDES_DIR, `${localeCode}.json`);
    if (!fs.existsSync(overridePath)) {
      console.warn(`Skip ${localeCode}: no overrides/${localeCode}.json`);
      continue;
    }
    const overrides = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
    const { applied, skipped } = applyOverrides(localeCode, overrides, enMap);
    console.log(`${localeCode}: applied ${applied}, skipped ${skipped}`);
  }
}

main();
