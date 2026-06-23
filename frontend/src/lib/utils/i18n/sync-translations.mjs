#!/usr/bin/env node
/**
 * Fills partial locale files with missing keys from en.
 * For each key in en: if locale has it, keep; else use en value.
 * Preserves en.ts line order and comments; only value part is replaced.
 *
 * Usage: node sync-translations.mjs [locale1 locale2 ...]
 * Default: fr de es ja zh ko ar hi it nl pl pt ru
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_DIR = __dirname;

// Match a key-value line: 'key': 'value' or 'key': "value"
const KEY_VALUE_LINE = /^(\s*'([^']+)':\s*)(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")(\s*,?\s*)$/;

function parseValue(raw) {
  const q = raw.trim().slice(0, 1);
  const inner = raw.trim().slice(1, -1);
  if (q === "'") return inner.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function escapeForSingleQuote(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function extractKeyValues(content) {
  const map = {};
  let m;
  const re = /^\s*'([^']+)':\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*,?\s*$/gm;
  while ((m = re.exec(content)) !== null) {
    map[m[1]] = parseValue(m[2]);
  }
  return map;
}

function getOrderedKeys(content) {
  const keys = [];
  const re = /^\s*'([^']+)':\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*,?\s*$/gm;
  let m;
  while ((m = re.exec(content)) !== null) keys.push(m[1]);
  return keys;
}

function mergeLocale(enContent, localeContent, localeCode) {
  const enMap = extractKeyValues(enContent);
  const localeMap = extractKeyValues(localeContent);
  const orderedKeys = getOrderedKeys(enContent);
  const merged = {};
  for (const k of orderedKeys) {
    merged[k] = localeMap[k] !== undefined ? localeMap[k] : enMap[k];
  }
  const missing = orderedKeys.filter((k) => localeMap[k] === undefined);
  return { merged, orderedKeys, missing, enMap };
}

function rewriteContent(enContent, merged, localeCode) {
  const lines = enContent.split('\n');
  const out = [];
  const exportRe = /^export const en: Record<string, string> = \{/;
  for (const line of lines) {
    if (exportRe.test(line)) {
      out.push(line.replace('export const en:', `export const ${localeCode}:`));
      continue;
    }
    const m = line.match(KEY_VALUE_LINE);
    if (m) {
      const key = m[2];
      const value = merged[key];
      if (value === undefined) {
        out.push(line);
        continue;
      }
      const escaped = escapeForSingleQuote(value);
      out.push(`${m[1]}'${escaped}'${m[3]}`);
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

function main() {
  const enPath = path.join(I18N_DIR, 'en.ts');
  const enContent = fs.readFileSync(enPath, 'utf8');
  const locales = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['fr', 'de', 'es', 'ja', 'zh', 'ko', 'ar', 'hi', 'it', 'nl', 'pl', 'pt', 'ru'];

  for (const code of locales) {
    const filePath = path.join(I18N_DIR, `${code}.ts`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skip ${code}: no ${code}.ts`);
      continue;
    }
    const localeContent = fs.readFileSync(filePath, 'utf8');
    const { merged, missing } = mergeLocale(enContent, localeContent, code);
    const newContent = rewriteContent(enContent, merged, code);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(
      `${code}.ts: filled ${missing.length} missing keys (total ${Object.keys(merged).length})`
    );
  }
}

main();
