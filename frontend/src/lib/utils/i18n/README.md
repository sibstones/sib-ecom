# i18n Translations Structure

This directory contains translation files for different languages. Each language has its own file.

## Translation coverage

| Status               | Languages                                            | Description                                                                                     |
| -------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Full (reference)** | `en`, `ru`                                           | All keys translated in that language (~2740+).                                                  |
| **Complete key set** | `fr`, `de`, `es`, `ja`, `zh`, `ko`, `ar`, `hi`, `it` | All keys present; untranslated keys use English text. Replace with real translations as needed. |

All active locale files have the same key set as `en`. Runtime: `t(key)` uses `translations[currentLang]?.[key] || translations.en[key] || key`.

## Current languages

### Full translations (reference)

- `en.ts` — English (source of truth)
- `ru.ts` — Russian

### Complete key set (mixed: own translations + EN for missing)

- `fr.ts`, `de.ts`, `es.ts`, `ja.ts`, `zh.ts`, `ko.ts`, `ar.ts`, `hi.ts`, `it.ts`

### Sync script

To refill missing keys from `en` after new keys are added:  
`node sync-translations.mjs [fr de es ja zh ko ar hi it]`

Keys that are still in English can be translated in the IDE (e.g. with AI) or by translators; replace the value in the locale file.

### Template / not in app

- `pt.ts`, `nl.ts`, `pl.ts` — add to `translations` and `supportedLanguages` when ready.

## Adding a New Language

To add a new language (e.g., `it` for Italian):

1. Create a new file `it.ts` in this directory:

```typescript
import { en } from './en';

// Italian translations
// TODO: Add Italian translations
// For now, using English as fallback
export const it: Record<string, string> = { ...en };
```

2. Import it in `/src/lib/utils/i18n.ts`:

```typescript
import { it } from './i18n/it';
```

3. Add it to the `translations` object:

```typescript
export const translations: Record<string, Record<string, string>> = {
  en,
  ru,
  fr,
  de,
  es,
  ja,
  zh,
  ko,
  it, // Add here
};
```

4. Add the language code to `/src/lib/stores/i18n.store.ts`:

```typescript
export const supportedLanguages = ['en', 'ru', 'fr', 'de', 'es', 'ja', 'zh', 'ko', 'it'];
```

## File Structure

Each language file exports a `Record<string, string>` object with translation keys and values:

```typescript
export const en: Record<string, string> = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  // ... more translations
};
```

## Benefits of This Structure

- **Modularity**: Each language is in its own file, making it easy to manage
- **Scalability**: Adding new languages doesn't bloat the main file
- **Maintainability**: Translators can work on individual language files
- **Performance**: Only needed languages can be loaded (if implementing lazy loading in the future)
