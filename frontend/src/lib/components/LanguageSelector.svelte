<script lang="ts">
  import { i18nStore, supportedLanguages } from '$lib/stores/i18n.store';
  import { applyLanguageSelection } from '$lib/utils/locale-preferences';
  import CustomSelect from './CustomSelect.svelte';

  let currentLang = $i18nStore;

  const languageNames: Record<string, string> = {
    en: 'English',
    ru: 'Русский',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    ja: '日本語',
    zh: '中文',
    ko: '한국어',
    ar: 'العربية',
    hi: 'हिन्दी',
    it: 'Italiano',
  };

  $: languageOptions = supportedLanguages.map((lang) => ({
    value: lang,
    label: languageNames[lang] || lang,
  }));

  async function changeLanguage(event: CustomEvent<{ value: string | number }>) {
    const next = String(event.detail.value);
    const changed = await applyLanguageSelection(next);
    if (!changed) return;
    currentLang = next;
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
</script>

<CustomSelect
  bind:value={currentLang}
  options={languageOptions}
  size="sm"
  on:change={changeLanguage}
/>
