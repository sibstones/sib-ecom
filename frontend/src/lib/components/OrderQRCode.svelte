<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import QRCode from 'qrcode';
  import { t } from '$lib/utils/i18n';
  import { browser } from '$app/environment';

  export let orderNumber: string;
  export let orderId: string;
  export let onClose: () => void;

  let qrDataUrl = '';
  let loading = true;
  let error = '';
  let scrollbarWidth = 0;

  onMount(async () => {
    // Prevent body scroll when modal opens
    if (browser) {
      scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
    await generateQRCode();
  });

  onDestroy(() => {
    // Restore body scroll when component is destroyed
    if (browser) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  });

  function handleClose() {
    // Restore body scroll before closing
    if (browser) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    onClose();
  }

  async function generateQRCode() {
    try {
      loading = true;
      error = '';

      // Create QR code data: order number and link to order page
      const qrData = JSON.stringify({
        orderNumber,
        orderId,
        type: 'delivery',
        timestamp: new Date().toISOString(),
      });

      // Generate QR code with beautiful settings
      qrDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 400,
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

  async function printQRCode() {
    if (!qrDataUrl) return;

    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        error = t('order.qrCodePrintFailed');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${t('order.deliveryQRCode')} - ${orderNumber}</title>
            <style>
              body {
                margin: 0;
                padding: 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: Arial, sans-serif;
              }
              .qr-container {
                text-align: center;
                margin-bottom: 20px;
              }
              .qr-code {
                max-width: 100%;
                height: auto;
                border: 2px solid #000;
                padding: 10px;
                background: white;
              }
              .order-info {
                text-align: center;
                margin-top: 20px;
              }
              .order-number {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .order-label {
                font-size: 14px;
                color: #666;
                margin-bottom: 5px;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="order-info">
                <div class="order-label">${t('order.orderNumber')}</div>
                <div class="order-number">${orderNumber}</div>
              </div>
              <img src="${qrDataUrl}" alt="${t('order.deliveryQRCode')}" class="qr-code" />
              <div class="order-info">
                <div class="order-label">${t('order.deliveryQRCode')}</div>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (e) {
      error = e instanceof Error ? e.message : t('order.qrCodePrintFailed');
    }
  }
</script>

<div
  class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="qr-modal-title"
  tabindex="-1"
>
  <button
    type="button"
    class="absolute inset-0 h-full w-full cursor-default bg-transparent"
    aria-hidden="true"
    tabindex="-1"
    on:click={handleClose}
  ></button>
  <div class="relative z-10 bg-white rounded-lg shadow-xl max-w-md w-full p-6" role="document">
    <div class="flex justify-between items-center mb-4">
      <h3 id="qr-modal-title" class="text-xl font-bold text-gray-900">
        {t('order.deliveryQRCode')}
      </h3>
      <button
        on:click={handleClose}
        class="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label={t('common.close')}
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    {#if loading}
      <div class="flex flex-col items-center justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
        <p class="text-gray-600">{t('order.generatingQRCode')}</p>
      </div>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p class="text-red-800">{error}</p>
      </div>
      <button
        on:click={generateQRCode}
        class="w-full px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors rounded"
      >
        {t('order.retryQRCode')}
      </button>
    {:else if qrDataUrl}
      <div class="space-y-4">
        <div class="bg-white border-2 border-gray-200 rounded-lg p-6 flex flex-col items-center">
          <div class="mb-4 text-center">
            <p class="text-sm text-gray-600 mb-1">{t('order.orderNumber')}</p>
            <p class="text-lg font-semibold text-gray-900">{orderNumber}</p>
          </div>
          <img src={qrDataUrl} alt={t('order.deliveryQRCode')} class="w-64 h-64 object-contain" />
          <p class="text-xs text-gray-500 mt-4 text-center">{t('order.qrCodeHint')}</p>
        </div>

        <div class="flex gap-3">
          <button
            on:click={downloadQRCode}
            class="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors rounded flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {t('order.downloadQRCode')}
          </button>
          <button
            on:click={printQRCode}
            class="flex-1 px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors rounded flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            {t('order.printQRCode')}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Removed CSS :has() selector - using JavaScript to control overflow instead */
</style>
