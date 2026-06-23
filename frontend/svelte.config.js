import adapterAuto from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const useStatic = process.env.ADAPTER_STATIC === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    alias: {
      $lib: 'src/lib',
    },
    adapter: useStatic
      ? adapterStatic({
          fallback: 'index.html',
          strict: false,
        })
      : adapterAuto(),
    paths: useStatic
      ? {
          relative: true,
        }
      : undefined,
  },
};

export default config;
