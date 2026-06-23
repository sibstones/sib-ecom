import { apiClient } from './client';

const SETTINGS_SECRET_PLACEHOLDER = '***hidden***';

function isRealSecretValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (!t) return false;
  if (t === SETTINGS_SECRET_PLACEHOLDER) return false;
  return true;
}

export interface TrackingInfo {
  trackingNumber: string;
  carrier?: string;
  status: string;
  statusDescription?: string;
  events?: Array<{
    status: string;
    description?: string;
    location?: string;
    date?: string;
    timestamp?: Date;
  }>;
  estimatedDelivery?: string;
  deliveredAt?: Date;
  returned?: boolean;
  /** Tracking page URL (from API or built per carrier) */
  trackingUrl?: string;
}

export interface CarrierOption {
  value: string;
  label: string;
  enabled: boolean;
}

export const deliveryTrackingApi = {
  checkTracking: (trackingNumber: string, carrier?: string) =>
    apiClient.post<{ trackingInfo: TrackingInfo }>('/delivery-tracking/check', {
      trackingNumber,
      carrier,
    }),

  updateOrderStatus: (orderId: string) =>
    apiClient.post<{ message: string }>(`/delivery-tracking/update/${orderId}`),

  checkAll: () => apiClient.post<{ message: string }>('/delivery-tracking/check-all'),

  checkNotReceived: () =>
    apiClient.post<{ message: string }>('/delivery-tracking/check-not-received'),

  testConnection: (provider: string, apiKey: string, apiUrl: string) =>
    apiClient.post<{ success: boolean; message?: string; error?: string }>(
      '/delivery-tracking/test-connection',
      {
        provider,
        apiKey,
        apiUrl,
      }
    ),

  getAvailableCarriers: async (locale: string = 'ru') => {
    const response = await apiClient.get<{ settings: any }>('/settings');
    const settings = response.settings;

    const carrierLabels: Record<string, { ru: string; en: string }> = {
      MANUAL: { ru: 'Ручной', en: 'Manual' },
      RUSSIAN_POST: { ru: 'Почта России', en: 'Russian Post' },
      CDEK: { ru: 'СДЭК', en: 'CDEK' },
      BOXBERRY: { ru: 'Boxberry', en: 'Boxberry' },
      YANDEX_DELIVERY: { ru: 'Яндекс.Доставка', en: 'Yandex Delivery' },
      DHL: { ru: 'DHL', en: 'DHL' },
      FEDEX: { ru: 'FedEx', en: 'FedEx' },
      UPS: { ru: 'UPS', en: 'UPS' },
      USPS: { ru: 'USPS', en: 'USPS' },
      ARAMEX: { ru: 'Aramex', en: 'Aramex' },
      AFTERSHIP: { ru: 'AfterShip (1000+ курьеров)', en: 'AfterShip (1000+ carriers)' },
      TRACKINGMORE: { ru: 'TrackingMore (1000+ курьеров)', en: 'TrackingMore (1000+ carriers)' },
      CUSTOM_API: { ru: 'Свой API', en: 'Custom API' },
    };

    const lang = locale === 'ru' ? 'ru' : 'en';
    const label = (code: string) => carrierLabels[code]?.[lang] ?? code;

    const carriers: CarrierOption[] = [{ value: 'MANUAL', label: label('MANUAL'), enabled: true }];

    const addedValues = new Set<string>(['MANUAL']);

    // 1) Провайдеры, добавленные в «Несколько провайдеров» (deliveryTrackingProviders)
    let providersMap: Record<string, { apiKey?: string; apiUrl?: string }> = {};
    try {
      const raw = settings.deliveryTrackingProviders;
      if (raw && typeof raw === 'string') providersMap = JSON.parse(raw) || {};
    } catch {
      providersMap = {};
    }
    for (const [code, cred] of Object.entries(providersMap)) {
      if (!code || addedValues.has(code)) continue;
      if (isRealSecretValue(cred?.apiKey)) {
        addedValues.add(code);
        carriers.push({ value: code, label: label(code), enabled: true });
      }
    }

    // 2) One default provider from settings (if not added yet and there is a key)
    const defaultProvider = settings.deliveryTrackingProvider;
    const defaultKey = settings.deliveryTrackingApiKey;
    if (defaultProvider && defaultProvider !== 'MANUAL' && !addedValues.has(defaultProvider)) {
      if (
        isRealSecretValue(defaultKey) ||
        isRealSecretValue(providersMap[defaultProvider]?.apiKey)
      ) {
        addedValues.add(defaultProvider);
        carriers.push({ value: defaultProvider, label: label(defaultProvider), enabled: true });
      }
    }

    return carriers;
  },
};
