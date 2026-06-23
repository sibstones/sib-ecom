import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load .env — Vite does not always substitute it before loading config
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || '3000';
  console.log(`[Vite] API proxy → localhost:${apiProxyTarget}`);

  return {
    plugins: [sveltekit()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${apiProxyTarget}`,
          changeOrigin: true,
          /** Helps the browser accept Set-Cookie from the proxied API (csrf_token double-submit). */
          cookieDomainRewrite: '',
          cookiePathRewrite: '/',
          configure(proxy) {
            let lastLog = 0;
            proxy.on('error', (...args) => {
              const [err] = args as [Error & { code?: string; cause?: { code?: string } }?];
              const isRefused = err?.code === 'ECONNREFUSED' || err?.cause?.code === 'ECONNREFUSED';
              if (isRefused && Date.now() - lastLog > 15000) {
                lastLog = Date.now();
                console.warn(
                  `[Vite] Backend is not available (localhost:${apiProxyTarget}). Start: ./scripts/dev-start.sh`
                );
              }
            });
          },
        },
        '^/(sitemap(-[a-z]+(-[0-9]+)?)?\\.xml|robots\\.txt)$': {
          target: `http://localhost:${apiProxyTarget}`,
          changeOrigin: true,
        },
        '^/(favicon\\.ico|favicon\\.svg|apple-touch-icon\\.png)$': {
          target: `http://localhost:${apiProxyTarget}`,
          changeOrigin: true,
        },
      },
    },
  };
});
