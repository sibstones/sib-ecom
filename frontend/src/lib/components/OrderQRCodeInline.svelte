<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import { t } from '$lib/utils/i18n';

  export let orderNumber: string;
  export let orderId: string;

  let qrDataUrl = '';
  let loading = true;
  let error = '';

  onMount(async () => {
    await generateQRCode();
  });

  async function generateQRCode() {
    try {
      loading = true;
      error = '';

      // Create data for the QR code: order ID for scanning by the delivery courier/service
      const qrData = orderId; // Use only the order ID for simplicity of scanning (delivery courier/service)

      // Generate a QR code with increased width for a rectangular view (delivery courier/service)
      qrDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 300,
        rendererOpts: {
          quality: 0.92,
        },
      });
    } catch (e) {
      error = e instanceof Error ? e.message : t('order.qrCodeGenerationFailed');
    } finally {
      loading = false;
    }
  }

  async function downloadQRCode() {
    if (!qrDataUrl) return;

    try {
      const link = document.createElement('a');
      link.download = `order-${orderNumber}-qr-code.png`;
      link.href = qrDataUrl;
      link.click();
    } catch (e) {
      error = e instanceof Error ? e.message : t('order.qrCodeDownloadFailed');
    }
  }
</script>

<div class="flex flex-col items-center gap-3">
  {#if loading}
    <div class="flex flex-col items-center justify-center py-4">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
      <p class="text-xs text-gray-600">{t('order.generatingQRCode')}</p>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-2 mb-2">
      <p class="text-xs text-red-800">{error}</p>
    </div>
    <button
      on:click={generateQRCode}
      class="px-3 py-1 text-xs bg-accent text-dark hover:bg-accent-muted transition-colors rounded"
    >
      {t('order.retryQRCode')}
    </button>
  {:else if qrDataUrl}
    <div class="bg-white border-2 border-gray-200 rounded-lg p-3 flex flex-col items-center">
      <div class="mb-2 text-center">
        <p class="text-xs text-gray-600 mb-1">{t('order.orderNumber')}</p>
        <p class="text-sm font-semibold text-gray-900">{orderNumber}</p>
      </div>
      <img src={qrDataUrl} alt={t('order.deliveryQRCode')} class="w-40 h-32 object-contain" />
      <p class="text-xs text-gray-500 mt-2 text-center">{t('order.qrCodeHint')}</p>
    </div>

    <button
      on:click={downloadQRCode}
      class="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors rounded text-sm flex items-center justify-center gap-2 w-full"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      {t('order.downloadQRCode')}
    </button>
  {/if}
</div>
