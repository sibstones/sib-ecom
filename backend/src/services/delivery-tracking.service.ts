import prisma from '../config/database';
import { settingsService } from './settings.service';
import { OrderStatus, InventoryStatus, Prisma } from '@prisma/client';
import { emailService } from './email.service';
import { yandexDeliveryService } from './yandex-delivery.service';
import https from 'https';
import http from 'http';
import { URL } from 'url';

export interface TrackingStatus {
  status: string;
  description?: string;
  location?: string;
  date?: string;
  timestamp?: Date;
}

export interface TrackingInfo {
  trackingNumber: string;
  carrier?: string;
  status: string;
  statusDescription?: string;
  events?: TrackingStatus[];
  estimatedDelivery?: string;
  deliveredAt?: Date;
  returned?: boolean;
}

const DEFAULT_PROVIDER_URLS: Record<string, string> = {
  RUSSIAN_POST: 'https://otpravka-api.pochta.ru',
  CDEK: 'https://api.cdek.ru',
  BOXBERRY: 'https://api.boxberry.ru',
  YANDEX_DELIVERY: 'https://b2b.taxi.yandex.net',
  DHL: 'https://api-eu.dhl.com',
  FEDEX: 'https://apis.fedex.com',
  UPS: 'https://onlinetools.ups.com',
  USPS: 'https://secure.shippingapis.com',
  ARAMEX: 'https://ws.aramex.net',
  AFTERSHIP: 'https://api.aftership.com',
  TRACKINGMORE: 'https://api.trackingmore.com',
};

export type ProviderCredentials = { apiKey: string; apiUrl: string };

export class DeliveryTrackingService {
  /**
   * Resolve API credentials for a carrier: from deliveryTrackingProviders (per-provider keys) or global settings.
   */
  private getCredentialsForCarrier(carrier: string, settings: any): ProviderCredentials {
    let providers: Record<string, { apiKey?: string; apiUrl?: string }> = {};
    try {
      const raw = settings.deliveryTrackingProviders;
      if (raw && typeof raw === 'string') {
        providers = JSON.parse(raw) || {};
      }
    } catch {
      providers = {};
    }
    const perProvider = carrier ? providers[carrier] : undefined;
    const apiKey = perProvider?.apiKey?.trim() || settings.deliveryTrackingApiKey?.trim() || '';
    const apiUrl =
      perProvider?.apiUrl?.trim() ||
      settings.deliveryTrackingApiUrl?.trim() ||
      DEFAULT_PROVIDER_URLS[carrier] ||
      '';
    return { apiKey, apiUrl };
  }

  /**
   * Check connection to API provider
   */
  async testConnection(
    provider: string,
    apiKey: string,
    apiUrl: string
  ): Promise<{ success: boolean; message: string }> {
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, message: 'API key is required' };
    }

    if (!apiUrl || apiUrl.trim() === '') {
      return { success: false, message: 'API URL is required' };
    }

    try {
      switch (provider) {
        case 'DHL':
          return await this.testDHLConnection(apiKey, apiUrl);
        case 'FEDEX':
          return await this.testFedExConnection(apiKey, apiUrl);
        case 'UPS':
          return await this.testUPSConnection(apiKey, apiUrl);
        case 'USPS':
          return await this.testUSPSConnection(apiKey, apiUrl);
        case 'ARAMEX':
          return await this.testAramexConnection(apiKey, apiUrl);
        case 'AFTERSHIP':
          return await this.testAfterShipConnection(apiKey, apiUrl);
        case 'TRACKINGMORE':
          return await this.testTrackingMoreConnection(apiKey, apiUrl);
        case 'RUSSIAN_POST':
          return await this.testRussianPostConnection(apiKey, apiUrl);
        case 'CDEK':
          return await this.testCDEKConnection(apiKey, apiUrl);
        case 'BOXBERRY':
          return await this.testBoxberryConnection(apiKey, apiUrl);
        case 'YANDEX_DELIVERY':
          return await this.testYandexDeliveryConnection(apiKey, apiUrl);
        case 'CUSTOM_API':
          return await this.testCustomAPIConnection(apiKey, apiUrl);
        case 'MANUAL':
          return { success: true, message: 'Manual mode - no API connection required' };
        default:
          return { success: false, message: `Unknown provider: ${provider}` };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Check tracking number through API provider
   */
  async checkTrackingNumber(
    trackingNumber: string,
    carrier?: string
  ): Promise<TrackingInfo | null> {
    const settings = await settingsService.getAllSettings();
    const actualCarrier = carrier;
    const provider = settings.deliveryTrackingProvider;
    const finalCarrier = actualCarrier || provider;

    const credentials = this.getCredentialsForCarrier(finalCarrier, settings);
    const settingsWithCredentials = {
      ...settings,
      deliveryTrackingApiKey: credentials.apiKey,
      deliveryTrackingApiUrl: credentials.apiUrl || DEFAULT_PROVIDER_URLS[finalCarrier] || '',
    };

    const apiRequiredCarriers = [
      'RUSSIAN_POST', 'CDEK', 'BOXBERRY', 'YANDEX_DELIVERY',
      'DHL', 'FEDEX', 'UPS', 'USPS', 'ARAMEX', 'AFTERSHIP', 'TRACKINGMORE', 'CUSTOM_API',
    ];
    if (finalCarrier !== 'MANUAL' && apiRequiredCarriers.includes(finalCarrier)) {
      if (!credentials.apiKey) {
        throw new Error(`API key is required for ${finalCarrier}. Configure it in Delivery Tracking settings (single provider or multiple providers).`);
      }
    }
    if (!actualCarrier && !settings.deliveryTrackingEnabled && finalCarrier === provider) {
      throw new Error('Delivery tracking is not enabled');
    }

    switch (finalCarrier) {
      case 'RUSSIAN_POST':
        return this.checkRussianPost(trackingNumber, settingsWithCredentials);
      case 'CDEK':
        return this.checkCDEK(trackingNumber, settingsWithCredentials);
      case 'BOXBERRY':
        return this.checkBoxberry(trackingNumber, settingsWithCredentials);
      case 'YANDEX_DELIVERY':
        return this.checkYandexDelivery(trackingNumber, settingsWithCredentials);
      case 'DHL':
        return this.checkDHL(trackingNumber, settingsWithCredentials);
      case 'FEDEX':
        return this.checkFedEx(trackingNumber, settingsWithCredentials);
      case 'UPS':
        return this.checkUPS(trackingNumber, settingsWithCredentials);
      case 'USPS':
        return this.checkUSPS(trackingNumber, settingsWithCredentials);
      case 'ARAMEX':
        return this.checkAramex(trackingNumber, settingsWithCredentials);
      case 'AFTERSHIP':
        return this.checkAfterShip(trackingNumber, settingsWithCredentials);
      case 'TRACKINGMORE':
        return this.checkTrackingMore(trackingNumber, settingsWithCredentials);
      case 'CUSTOM_API':
        return this.checkCustomAPI(trackingNumber, carrier, settingsWithCredentials);
      case 'MANUAL':
      default:
        return {
          trackingNumber,
          carrier: carrier || 'MANUAL',
          status: 'UNKNOWN',
        };
    }
  }

  /**
   * Helper function for HTTP requests
   */
  private async httpRequest(
    url: string,
    options: { headers?: Record<string, string>; method?: string; body?: string } = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      const method = options.method || 'GET';
      const body = options.body;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      if (body) {
        headers['Content-Length'] = Buffer.byteLength(body, 'utf8').toString();
      }

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (!data || data.trim() === '') {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve({});
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage || 'Empty response'}`));
              }
              return;
            }
            const jsonData = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(jsonData);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end(body || undefined);
    });
  }

  /**
   * Check through API Russian Post
   */
  private async checkRussianPost(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      // Here should be integration with Russian Post API
      // Пример: https://otpravka.pochta.ru/specification#/orders-tracking_order
      const apiKey = settings.deliveryTrackingApiKey;
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://otpravka-api.pochta.ru';

      // Stub for example - in reality real API should be used
      const data = await this.httpRequest(`${apiUrl}/tracking/${trackingNumber}`, {
        headers: {
          'Authorization': `AccessToken ${apiKey}`,
        },
      });

      return {
        trackingNumber,
        carrier: 'RUSSIAN_POST',
        status: this.mapRussianPostStatus(data.status),
        statusDescription: data.statusDescription,
        events: data.events?.map((e: any) => ({
          status: e.status,
          description: e.description,
          location: e.location,
          date: e.date,
          timestamp: e.timestamp ? new Date(e.timestamp) : undefined,
        })),
        estimatedDelivery: data.estimatedDelivery,
        deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined,
        returned: data.returned || false,
      };
    } catch (error) {
      console.error('Error checking Russian Post tracking:', error);
      return null;
    }
  }

  /**
   * Check through API CDEK
   */
  private async checkCDEK(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey;
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://api.cdek.ru';

      // Stub for example - in reality real API should be used
      const data = await this.httpRequest(`${apiUrl}/v2/orders/${trackingNumber}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      return {
        trackingNumber,
        carrier: 'CDEK',
        status: this.mapCDEKStatus(data.status),
        statusDescription: data.statusDescription,
        events: data.events?.map((e: any) => ({
          status: e.status,
          description: e.description,
          location: e.location,
          date: e.date,
          timestamp: e.timestamp ? new Date(e.timestamp) : undefined,
        })),
        estimatedDelivery: data.estimatedDelivery,
        deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined,
        returned: data.returned || false,
      };
    } catch (error) {
      console.error('Error checking CDEK tracking:', error);
      return null;
    }
  }

  /**
   * Check through API Boxberry
   */
  private async checkBoxberry(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey;
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://api.boxberry.ru';

      // Stub for example - in reality real API should be used
      const data = await this.httpRequest(`${apiUrl}/json.php?token=${apiKey}&method=ListOrders&ImId=${trackingNumber}`);

      return {
        trackingNumber,
        carrier: 'BOXBERRY',
        status: this.mapBoxberryStatus(data.status),
        statusDescription: data.statusDescription,
        events: data.events?.map((e: any) => ({
          status: e.status,
          description: e.description,
          location: e.location,
          date: e.date,
          timestamp: e.timestamp ? new Date(e.timestamp) : undefined,
        })),
        estimatedDelivery: data.estimatedDelivery,
        deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined,
        returned: data.returned || false,
      };
    } catch (error) {
      console.error('Error checking Boxberry tracking:', error);
      return null;
    }
  }

  /**
   * Check through API Yandex Delivery
   */
  private async checkYandexDelivery(
    trackingNumber: string,
    _settings: any
  ): Promise<TrackingInfo | null> {
    try {
      // Use yandexDeliveryService to get information about the claim
      const claim = await yandexDeliveryService.getClaimInfo(trackingNumber);

      // Mapping Yandex Delivery statuses to standard tracking statuses
      const statusMap: Record<string, string> = {
        'new': 'PROCESSING',
        'estimating': 'PROCESSING',
        'estimating_failed': 'ERROR',
        'ready_for_approval': 'PROCESSING',
        'accepted': 'IN_TRANSIT',
        'performer_lookup': 'IN_TRANSIT',
        'performer_draft': 'IN_TRANSIT',
        'performer_found': 'IN_TRANSIT',
        'pickup_arrived': 'IN_TRANSIT',
        'ready_for_pickup_confirmation': 'IN_TRANSIT',
        'pickuped': 'IN_TRANSIT',
        'delivery_arrived': 'OUT_FOR_DELIVERY',
        'ready_for_delivery_confirmation': 'OUT_FOR_DELIVERY',
        'delivered': 'DELIVERED',
        'delivered_finish': 'DELIVERED',
        'cancelled': 'CANCELLED',
        'cancelled_by_taxi': 'CANCELLED',
        'cancelled_with_payment': 'CANCELLED',
        'returning': 'RETURNED',
        'returned': 'RETURNED',
        'returned_finish': 'RETURNED',
      };

      const status = statusMap[claim.status] || 'UNKNOWN';

      return {
        trackingNumber,
        carrier: 'YANDEX_DELIVERY',
        status,
        statusDescription: this.getYandexDeliveryStatusDescription(claim.status),
        events: [
          {
            status,
            description: this.getYandexDeliveryStatusDescription(claim.status),
            timestamp: claim.updated_at ? new Date(claim.updated_at) : undefined,
          },
        ],
        deliveredAt: status === 'DELIVERED' && claim.updated_at ? new Date(claim.updated_at) : undefined,
        returned: status === 'RETURNED',
      };
    } catch (error) {
      console.error('Error checking Yandex Delivery tracking:', error);
      return null;
    }
  }

  /**
   * Get description of Yandex Delivery status
   */
  private getYandexDeliveryStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      'new': 'Новая заявка',
      'estimating': 'Расчет стоимости',
      'estimating_failed': 'Ошибка расчета стоимости',
      'ready_for_approval': 'Готова к подтверждению',
      'accepted': 'Принята',
      'performer_lookup': 'Поиск исполнителя',
      'performer_draft': 'Исполнитель назначен',
      'performer_found': 'Исполнитель найден',
      'pickup_arrived': 'Исполнитель прибыл на точку забора',
      'ready_for_pickup_confirmation': 'Готова к подтверждению забора',
      'pickuped': 'Забрана',
      'delivery_arrived': 'Исполнитель прибыл на точку доставки',
      'ready_for_delivery_confirmation': 'Готова к подтверждению доставки',
      'delivered': 'Доставлена',
      'delivered_finish': 'Доставка завершена',
      'cancelled': 'Отменена',
      'cancelled_by_taxi': 'Отменена службой',
      'cancelled_with_payment': 'Отменена с оплатой',
      'returning': 'Возвращается',
      'returned': 'Возвращена',
      'returned_finish': 'Возврат завершен',
    };
    return descriptions[status] || status;
  }

  /**
   * Check through custom API
   */
  private async checkCustomAPI(
    trackingNumber: string,
    carrier: string | undefined,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey;
      const apiUrl = settings.deliveryTrackingApiUrl;

      if (!apiUrl) {
        throw new Error('Custom API URL is not configured');
      }

      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const data = await this.httpRequest(`${apiUrl}/track/${trackingNumber}`, {
        headers,
      });

      return {
        trackingNumber,
        carrier: carrier || data.carrier || 'UNKNOWN',
        status: data.status || 'UNKNOWN',
        statusDescription: data.statusDescription,
        events: data.events,
        estimatedDelivery: data.estimatedDelivery,
        deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined,
        returned: data.returned || false,
      };
    } catch (error) {
      console.error('Error checking custom API tracking:', error);
      return null;
    }
  }

  /**
   * Map Russian Post statuses to order statuses
   */
  private mapRussianPostStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'REGISTERED': 'SHIPPED',
      'IN_TRANSIT': 'SHIPPED',
      'ARRIVED': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'RETURNED': 'RETURNED',
      'NOT_RECEIVED': 'RETURN_REQUESTED',
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Map CDEK statuses to order statuses
   */
  private mapCDEKStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'ACCEPTED': 'SHIPPED',
      'IN_TRANSIT': 'SHIPPED',
      'ARRIVED': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'RETURNED': 'RETURNED',
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Map Boxberry statuses to order statuses
   */
  private mapBoxberryStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'ACCEPTED': 'SHIPPED',
      'IN_TRANSIT': 'SHIPPED',
      'ARRIVED': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'RETURNED': 'RETURNED',
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Check through API DHL
   */
  private async checkDHL(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey;
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://api-eu.dhl.com';

      // DHL Tracking API v2
      // Documentation: https://developer.dhl.com/api-reference/track-and-trace
      const data = await this.httpRequest(`${apiUrl}/track/shipments?trackingNumber=${trackingNumber}`, {
        headers: {
          'DHL-API-Key': apiKey,
          'Accept': 'application/json',
        },
      });

      // Handle DHL API response
      const shipment = data.shipments?.[0];
      if (!shipment) {
        throw new Error('Shipment not found');
      }

      const status = shipment.status?.status || 'UNKNOWN';
      const events = shipment.events?.map((e: any) => ({
        status: e.statusCode || status,
        description: e.description || e.status,
        location: e.location?.address?.addressLocality || e.location?.address?.city,
        date: e.timestamp ? new Date(e.timestamp).toISOString().split('T')[0] : undefined,
        timestamp: e.timestamp ? new Date(e.timestamp) : undefined,
      }));

      return {
        trackingNumber,
        carrier: 'DHL',
        status: this.mapDHLStatus(status),
        statusDescription: shipment.status?.description || shipment.status?.status,
        events,
        estimatedDelivery: shipment.estimatedTimeOfDelivery,
        deliveredAt: status === 'DELIVERED' && shipment.events?.[0]?.timestamp 
          ? new Date(shipment.events[0].timestamp) 
          : undefined,
        returned: status === 'RETURNED' || status === 'RETURNED_TO_SHIPPER',
      };
    } catch (error) {
      console.error('Error checking DHL tracking:', error);
      return null;
    }
  }

  /**
   * Check through API FedEx
   */
  private async checkFedEx(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey;
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://apis.fedex.com';

      // FedEx Tracking API
      // Documentation: https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html
      // OAuth token is required for authentication
      // Note: For production, Client Secret in a separate field is needed
      const clientId = apiKey;
      const clientSecret = settings.deliveryTrackingApiKey; // In reality, a separate Client Secret is needed
      
      // Get OAuth token through POST with form-data
      const tokenData = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
      
      const tokenResponse = await this.httpPostFormRequest(`${apiUrl}/oauth/token`, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const accessToken = tokenResponse.access_token;

      if (!accessToken) {
        throw new Error('Failed to get FedEx access token');
      }

      // Request for tracking
      const trackingData = {
        trackingInfo: [{
          trackingNumberInfo: {
            trackingNumber: trackingNumber,
          },
        }],
        includeDetailedScans: true,
      };

      // Use POST request for FedEx
      const data = await this.httpPostRequest(`${apiUrl}/track/v1/trackingnumbers`, trackingData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-locale': 'en_US',
        },
      });

      const trackingResult = data.output?.completeTrackResults?.[0]?.trackResults?.[0];
      if (!trackingResult) {
        throw new Error('Tracking result not found');
      }

      const status = trackingResult.latestStatusDetail?.code || 'UNKNOWN';
      const events = trackingResult.scanEvents?.map((e: any) => ({
        status: e.eventType || status,
        description: e.eventDescription || e.eventType,
        location: e.scanLocation?.city || e.scanLocation?.stateOrProvinceCode,
        date: e.date ? new Date(e.date).toISOString().split('T')[0] : undefined,
        timestamp: e.date ? new Date(e.date) : undefined,
      }));

      return {
        trackingNumber,
        carrier: 'FEDEX',
        status: this.mapFedExStatus(status),
        statusDescription: trackingResult.latestStatusDetail?.description || trackingResult.latestStatusDetail?.code,
        events,
        estimatedDelivery: trackingResult.estimatedDeliveryDetails?.estimatedDeliveryTimestamp,
        deliveredAt: status === 'DL' && trackingResult.scanEvents?.[0]?.date 
          ? new Date(trackingResult.scanEvents[0].date) 
          : undefined,
        returned: status === 'OD' || status === 'RS',
      };
    } catch (error) {
      console.error('Error checking FedEx tracking:', error);
      return null;
    }
  }

  /**
   * Helper function for POST requests with form-data
   */
  private async httpPostFormRequest(url: string, formData: string, options: { headers?: Record<string, string> } = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formData),
          ...options.headers,
        },
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(jsonData);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(formData);
      req.end();
    });
  }

  /**
   * Helper function for POST requests
   */
  private async httpPostRequest(url: string, body: any, options: { headers?: Record<string, string> } = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const bodyString = JSON.stringify(body);

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString),
          ...options.headers,
        },
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(jsonData);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(bodyString);
      req.end();
    });
  }

  /**
   * Map DHL statuses to order statuses
   */
  private mapDHLStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'PRE_TRANSIT': 'SHIPPED',
      'TRANSIT': 'SHIPPED',
      'OUT_FOR_DELIVERY': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'RETURNED': 'RETURNED',
      'RETURNED_TO_SHIPPER': 'RETURNED',
      'EXCEPTION': 'RETURN_REQUESTED',
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Маппинг статусов FedEx к статусам заказа
   */
  private mapFedExStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'OC': 'SHIPPED', // On FedEx vehicle for delivery
      'OD': 'DELIVERED', // On FedEx vehicle for delivery (delivered)
      'DL': 'DELIVERED', // Delivered
      'DP': 'SHIPPED', // Departed FedEx location
      'AF': 'SHIPPED', // At FedEx facility
      'RS': 'RETURNED', // Return to shipper
      'CA': 'RETURN_REQUESTED', // Shipment exception
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Проверка через API UPS
   */
  private async checkUPS(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey;
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://onlinetools.ups.com';

      // UPS Tracking API
      // Documentation: https://developer.ups.com/api/reference
      // OAuth token is required for authentication
      const clientId = apiKey;
      const clientSecret = settings.deliveryTrackingApiKey; // In reality, a separate Client Secret is needed
      
      // Get OAuth token
      const tokenData = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
      const tokenResponse = await this.httpPostFormRequest(`${apiUrl}/security/v1/oauth/token`, tokenData);

      const accessToken = tokenResponse.access_token;
      if (!accessToken) {
        throw new Error('Failed to get UPS access token');
      }

      // Request for tracking
      const trackingData = {
        TrackingRequest: {
          Request: {
            RequestOption: '1',
            TransactionReference: {
              CustomerContext: 'Tracking Request'
            }
          },
          InquiryNumber: trackingNumber
        }
      };

      const data = await this.httpPostRequest(`${apiUrl}/track/v1/details/${trackingNumber}`, trackingData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'transId': 'tracking-' + Date.now(),
          'transactionSrc': 'Fashion Store',
        },
      });

      const trackingResult = data.TrackResponse?.Shipment?.[0];
      if (!trackingResult) {
        throw new Error('Tracking result not found');
      }

      const status = trackingResult.CurrentStatus?.Code || 'UNKNOWN';
      const events = trackingResult.Package?.Activity?.map((e: any) => ({
        status: e.Status?.Code || status,
        description: e.Status?.Description || e.ActivityLocation?.Description,
        location: e.ActivityLocation?.Address?.City || e.ActivityLocation?.Address?.StateProvinceCode,
        date: e.Date ? e.Date.split('T')[0] : undefined,
        timestamp: e.Date ? new Date(e.Date) : undefined,
      }));

      return {
        trackingNumber,
        carrier: 'UPS',
        status: this.mapUPSStatus(status),
        statusDescription: trackingResult.CurrentStatus?.Description || trackingResult.CurrentStatus?.Code,
        events,
        estimatedDelivery: trackingResult.ScheduledDeliveryDate,
        deliveredAt: status === 'D' && trackingResult.Package?.Activity?.[0]?.Date 
          ? new Date(trackingResult.Package.Activity[0].Date) 
          : undefined,
        returned: status === 'R' || status === 'RS',
      };
    } catch (error) {
      console.error('Error checking UPS tracking:', error);
      return null;
    }
  }

  /**
   * Check through API USPS
   */
  private async checkUSPS(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey; // USPS User ID
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://secure.shippingapis.com';

      // USPS Tracking API
      // Documentation: https://www.usps.com/business/web-tools-apis/
      // Uses XML format
      const xmlRequest = `<?xml version="1.0"?>
<TrackFieldRequest USERID="${apiKey}">
  <TrackID ID="${trackingNumber}"></TrackID>
</TrackFieldRequest>`;

      const data = await this.httpPostRequest(`${apiUrl}/ShippingAPI.dll?API=TrackV2&XML=${encodeURIComponent(xmlRequest)}`, {}, {
        headers: {
          'Content-Type': 'application/xml',
        },
      });

      // Parse XML response (simplified version)
      // In reality, a XML parser is needed
      const trackingResult = data.TrackResponse?.TrackInfo?.[0];
      if (!trackingResult) {
        throw new Error('Tracking result not found');
      }

      const status = trackingResult.StatusCategory || 'UNKNOWN';
      const events = trackingResult.TrackDetail?.map((e: any) => ({
        status: e.Event || status,
        description: e.Event || e.EventDate,
        location: e.EventCity || e.EventState,
        date: e.EventDate ? e.EventDate.split(' ')[0] : undefined,
        timestamp: e.EventDate ? new Date(e.EventDate) : undefined,
      }));

      return {
        trackingNumber,
        carrier: 'USPS',
        status: this.mapUSPSStatus(status),
        statusDescription: trackingResult.StatusSummary || trackingResult.StatusCategory,
        events,
        estimatedDelivery: trackingResult.ExpectedDeliveryDate,
        deliveredAt: status === 'Delivered' && trackingResult.TrackDetail?.[0]?.EventDate 
          ? new Date(trackingResult.TrackDetail[0].EventDate) 
          : undefined,
        returned: status === 'Returned' || status === 'Return to Sender',
      };
    } catch (error) {
      console.error('Error checking USPS tracking:', error);
      return null;
    }
  }

  /**
   * Check through API Aramex
   */
  private async checkAramex(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey; // Account Number
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://ws.aramex.net';

      // Aramex Tracking API
      // Documentation: https://www.aramex.com/developers
      const trackingData = {
        ClientInfo: {
          AccountNumber: apiKey,
          UserName: settings.deliveryTrackingApiKey, // In reality, a separate username is needed
          Password: settings.deliveryTrackingApiKey, // In reality, a separate password is needed
          Version: 'v1.0',
          AccountCountryCode: 'US',
        },
        Transaction: {
          Reference1: trackingNumber,
        },
        Shipments: [trackingNumber],
      };

      const data = await this.httpPostRequest(`${apiUrl}/shippingapi.v2/tracking/service_1_0.svc/json/TrackShipments`, trackingData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const trackingResult = data.TrackingResults?.[0];
      if (!trackingResult) {
        throw new Error('Tracking result not found');
      }

      const status = trackingResult.UpdateCode || 'UNKNOWN';
      const events = trackingResult.UpdateDetails?.map((e: any) => ({
        status: e.UpdateCode || status,
        description: e.UpdateDescription || e.UpdateCode,
        location: e.UpdateLocation || e.UpdateLocationCity,
        date: e.UpdateDateTime ? new Date(e.UpdateDateTime).toISOString().split('T')[0] : undefined,
        timestamp: e.UpdateDateTime ? new Date(e.UpdateDateTime) : undefined,
      }));

      return {
        trackingNumber,
        carrier: 'ARAMEX',
        status: this.mapAramexStatus(status),
        statusDescription: trackingResult.UpdateDescription || trackingResult.UpdateCode,
        events,
        estimatedDelivery: trackingResult.EstimatedDeliveryDate,
        deliveredAt: status === 'DR' && trackingResult.UpdateDetails?.[0]?.UpdateDateTime 
          ? new Date(trackingResult.UpdateDetails[0].UpdateDateTime) 
          : undefined,
        returned: status === 'RT' || status === 'RS',
      };
    } catch (error) {
      console.error('Error checking Aramex tracking:', error);
      return null;
    }
  }

  /**
   * Check through AfterShip API (multi-provider)
   */
  private async checkAfterShip(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey; // AfterShip API Key
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://api.aftership.com';

      // AfterShip Tracking API
      // Documentation: https://www.aftership.com/docs/tracking
      // Supports 1000+ carriers through one API
      const data = await this.httpRequest(`${apiUrl}/v4/trackings/${trackingNumber}`, {
        headers: {
          'aftership-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const tracking = data.data?.tracking;
      if (!tracking) {
        throw new Error('Tracking not found');
      }

      const status = tracking.tag || 'UNKNOWN';
      const events = tracking.checkpoints?.map((e: any) => ({
        status: e.tag || status,
        description: e.message || e.tag,
        location: e.location || e.city_name,
        date: e.checkpoint_time ? new Date(e.checkpoint_time).toISOString().split('T')[0] : undefined,
        timestamp: e.checkpoint_time ? new Date(e.checkpoint_time) : undefined,
      }));

      return {
        trackingNumber,
        carrier: tracking.slug?.toUpperCase() || 'UNKNOWN',
        status: this.mapAfterShipStatus(status),
        statusDescription: tracking.title || tracking.tag,
        events,
        estimatedDelivery: tracking.expected_delivery,
        deliveredAt: status === 'Delivered' && tracking.checkpoints?.[0]?.checkpoint_time 
          ? new Date(tracking.checkpoints[0].checkpoint_time) 
          : undefined,
        returned: status === 'Returned' || status === 'Exception',
      };
    } catch (error) {
      console.error('Error checking AfterShip tracking:', error);
      return null;
    }
  }

  /**
   * Check through TrackingMore API (multi-provider)
   */
  private async checkTrackingMore(
    trackingNumber: string,
    settings: any
  ): Promise<TrackingInfo | null> {
    try {
      const apiKey = settings.deliveryTrackingApiKey; // TrackingMore API Key
      const apiUrl = settings.deliveryTrackingApiUrl || 'https://api.trackingmore.com';

      // TrackingMore API
      // Documentation: https://trackingmore.com/tracking-api
      // Supports 1000+ carriers through one API
      const data = await this.httpRequest(`${apiUrl}/v4/trackings/get?tracking_number=${trackingNumber}`, {
        headers: {
          'Tracking-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const tracking = data.data;
      if (!tracking) {
        throw new Error('Tracking not found');
      }

      const status = tracking.status || 'UNKNOWN';
      const events = tracking.origin_info?.trackinfo?.map((e: any) => ({
        status: e.StatusCode || status,
        description: e.StatusDescription || e.StatusCode,
        location: e.Details || e.Location,
        date: e.Date ? e.Date.split(' ')[0] : undefined,
        timestamp: e.Date ? new Date(e.Date) : undefined,
      }));

      return {
        trackingNumber,
        carrier: tracking.carrier_code?.toUpperCase() || 'UNKNOWN',
        status: this.mapTrackingMoreStatus(status),
        statusDescription: tracking.status_description || tracking.status,
        events,
        estimatedDelivery: tracking.estimated_delivery_date,
        deliveredAt: status === 'delivered' && tracking.origin_info?.trackinfo?.[0]?.Date 
          ? new Date(tracking.origin_info.trackinfo[0].Date) 
          : undefined,
        returned: status === 'returned' || status === 'exception',
      };
    } catch (error) {
      console.error('Error checking TrackingMore tracking:', error);
      return null;
    }
  }

  /**
   * Map UPS statuses to order statuses
   */
  private mapUPSStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'I': 'SHIPPED', // In Transit
      'P': 'SHIPPED', // Pickup
      'D': 'DELIVERED', // Delivered
      'X': 'RETURNED', // Exception
      'R': 'RETURNED', // Returned
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Map USPS statuses to order statuses
   */
  private mapUSPSStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'In Transit': 'SHIPPED',
      'Out for Delivery': 'SHIPPED',
      'Delivered': 'DELIVERED',
      'Returned': 'RETURNED',
      'Return to Sender': 'RETURNED',
      'Exception': 'RETURN_REQUESTED',
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Map Aramex statuses to order statuses
   */
  private mapAramexStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'SH': 'SHIPPED', // Shipment Picked Up
      'IT': 'SHIPPED', // In Transit
      'OD': 'SHIPPED', // Out for Delivery
      'DR': 'DELIVERED', // Delivered
      'RT': 'RETURNED', // Returned
      'RS': 'RETURNED', // Return to Sender
      'EX': 'RETURN_REQUESTED', // Exception
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Map AfterShip statuses to order statuses
   */
  private mapAfterShipStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'Pending': 'SHIPPED',
      'InTransit': 'SHIPPED',
      'OutForDelivery': 'SHIPPED',
      'Delivered': 'DELIVERED',
      'Exception': 'RETURN_REQUESTED',
      'Returned': 'RETURNED',
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Map TrackingMore statuses to order statuses
   */
  private mapTrackingMoreStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'SHIPPED',
      'in_transit': 'SHIPPED',
      'out_for_delivery': 'SHIPPED',
      'delivered': 'DELIVERED',
      'exception': 'RETURN_REQUESTED',
      'returned': 'RETURNED',
    };
    return statusMap[status] || 'SHIPPED';
  }

  /**
   * Test methods for connecting to each provider
   */
  private async testDHLConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // Test request to DHL API (health check or test tracking number)
      const testUrl = `${apiUrl}/track/shipments?trackingNumber=TEST1234567890`;
      await this.httpRequest(testUrl, {
        headers: {
          'DHL-API-Key': apiKey,
          'Accept': 'application/json',
        },
      });
      return { success: true, message: 'DHL API connection successful' };
    } catch (error: any) {
      // If the error is 404 or 400, it is normal for the test tracking number, so the API is working
      if (error.message?.includes('404') || error.message?.includes('400')) {
        return { success: true, message: 'DHL API is reachable (test tracking number not found, but API is working)' };
      }
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid API key or insufficient permissions' };
      }
      return { success: false, message: `DHL API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testFedExConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // FedEx requires an OAuth token, check the token is received
      const tokenUrl = `${apiUrl}/oauth/token`;
      const formData = `grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(apiKey)}`;
      
      await this.httpPostFormRequest(tokenUrl, formData);
      return { success: true, message: 'FedEx API connection successful (OAuth token obtained)' };
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid Client ID/Secret or insufficient permissions' };
      }
      return { success: false, message: `FedEx API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testUPSConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // UPS requires an OAuth token
      const tokenUrl = `${apiUrl}/security/v1/oauth/token`;
      const formData = `grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(apiKey)}`;
      
      await this.httpPostFormRequest(tokenUrl, formData);
      return { success: true, message: 'UPS API connection successful (OAuth token obtained)' };
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid Client ID/Secret or insufficient permissions' };
      }
      return { success: false, message: `UPS API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testUSPSConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // USPS uses XML, make a simple test request
      const testUrl = `${apiUrl}/ShippingAPI.dll?API=TrackV2&XML=${encodeURIComponent(`<?xml version="1.0"?><TrackFieldRequest USERID="${apiKey}"><TrackID ID="TEST123"></TrackID></TrackFieldRequest>`)}`;
      
      await this.httpRequest(testUrl);
      return { success: true, message: 'USPS API connection successful' };
    } catch (error: any) {
      if (error.message?.includes('80040B1A') || error.message?.includes('80040B19')) {
        return { success: false, message: 'Invalid User ID' };
      }
      // If the error is related to the test tracking number - API works
      if (error.message?.includes('TEST123')) {
        return { success: true, message: 'USPS API is reachable (test tracking number not found, but API is working)' };
      }
      return { success: false, message: `USPS API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testAramexConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // Test request to Aramex API
      const testData = {
        ClientInfo: {
          AccountNumber: apiKey,
          UserName: apiKey,
          Password: apiKey,
          Version: 'v1.0',
          AccountCountryCode: 'US',
        },
        Transaction: {
          Reference1: 'TEST',
        },
        Shipments: ['TEST123'],
      };

      await this.httpPostRequest(`${apiUrl}/shippingapi.v2/tracking/service_1_0.svc/json/TrackShipments`, testData);
      return { success: true, message: 'Aramex API connection successful' };
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid Account Number or credentials' };
      }
      return { success: false, message: `Aramex API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testAfterShipConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // AfterShip API - check availability through a simple request
      await this.httpRequest(`${apiUrl}/v4/couriers`, {
        headers: {
          'aftership-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      return { success: true, message: 'AfterShip API connection successful' };
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid API key' };
      }
      return { success: false, message: `AfterShip API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testTrackingMoreConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // TrackingMore API - check availability through a list of couriers
      await this.httpRequest(`${apiUrl}/v4/couriers`, {
        headers: {
          'Tracking-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      return { success: true, message: 'TrackingMore API connection successful' };
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid API key' };
      }
      return { success: false, message: `TrackingMore API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testRussianPostConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // Russian Post - check the API is available
      await this.httpRequest(`${apiUrl}/1.0/user/balance`, {
        headers: {
          'Authorization': `AccessToken ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return { success: true, message: 'Russian Post API connection successful' };
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid API key or insufficient permissions' };
      }
      return { success: false, message: `Russian Post API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testCDEKConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // CDEK - check the API is available through a test request
      await this.httpRequest(`${apiUrl}/v2/location/cities`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return { success: true, message: 'CDEK API connection successful' };
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid API key or insufficient permissions' };
      }
      return { success: false, message: `CDEK API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testBoxberryConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // Boxberry - check the API is available through a test request
      await this.httpRequest(`${apiUrl}/json.php?token=${apiKey}&method=ListCities`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return { success: true, message: 'Boxberry API connection successful' };
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid token or insufficient permissions' };
      }
      return { success: false, message: `Boxberry API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testYandexDeliveryConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // Yandex Delivery API: claims/info requires POST and claim_id in query (documentation b2b.taxi.yandex.net)
      // Use test claim_id — 400/404 means the API is available and the token is valid
      const testClaimId = '00000000000000000000000000000000';
      const url = `${apiUrl.replace(/\/$/, '')}/b2b/cargo/integration/v2/claims/info?claim_id=${testClaimId}`;
      await this.httpRequest(url, {
        method: 'POST',
        body: '{}',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return { success: true, message: 'Yandex Delivery API connection successful' };
    } catch (error: any) {
      // 400 or 404 — API is available, token is valid, but the test claim_id is incorrect/invalid
      if (error.message?.includes('400') || error.message?.includes('404')) {
        return { success: true, message: 'Yandex Delivery API is available (requires a valid claim_id for full verification)' };
      }
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return { success: false, message: 'Invalid OAuth token or insufficient permissions' };
      }
      return { success: false, message: `Yandex Delivery API error: ${error.message || 'Unknown error'}` };
    }
  }

  private async testCustomAPIConnection(apiKey: string, apiUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // For custom API, make a simple GET request to the base URL
      await this.httpRequest(apiUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return { success: true, message: 'Custom API connection successful' };
    } catch (error: any) {
      // If there is a response (even with an error), it means the API is available
      if (error.message && !error.message.includes('ECONNREFUSED') && !error.message.includes('ENOTFOUND')) {
        return { success: true, message: 'Custom API is reachable (endpoint responded)' };
      }
      return { success: false, message: `Custom API error: ${error.message || 'Cannot reach API endpoint'}` };
    }
  }

  /**
   * Update order status based on tracking number
   */
  async updateOrderStatusByTracking(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        paymentRequest: true,
        user: true,
      },
    });

    if (!order || !order.paymentRequest?.logisticsInfo) {
      throw new Error('Order or tracking information not found');
    }

    const logisticsInfo = order.paymentRequest.logisticsInfo as any;
    const trackingNumber = logisticsInfo.trackingNumber;
    const carrier = logisticsInfo.carrier;

    if (!trackingNumber) {
      throw new Error('Tracking number not found');
    }

    const trackingInfo = await this.checkTrackingNumber(trackingNumber, carrier);

    if (!trackingInfo) {
      throw new Error('Failed to get tracking information');
    }

    const settings = await settingsService.getAllSettings();
    let newOrderStatus: OrderStatus | null = null;

    // Use status mapping from settings
    if (settings.deliveryTrackingStatusMapping) {
      try {
        const statusMapping = JSON.parse(settings.deliveryTrackingStatusMapping);
        const providerMapping = statusMapping[carrier || settings.deliveryTrackingProvider];
        if (providerMapping && providerMapping[trackingInfo.status]) {
          newOrderStatus = providerMapping[trackingInfo.status] as OrderStatus;
        }
      } catch (error) {
        console.error('Error parsing status mapping:', error);
      }
    }

    // If the mapping did not work, use direct check
    if (!newOrderStatus) {
      if (trackingInfo.status === 'DELIVERED' || trackingInfo.deliveredAt) {
        newOrderStatus = OrderStatus.DELIVERED;
      } else if (trackingInfo.returned) {
        newOrderStatus = OrderStatus.RETURNED;
      } else if (trackingInfo.status === 'SHIPPED' || trackingInfo.status === 'IN_TRANSIT') {
        newOrderStatus = OrderStatus.SHIPPED;
      }
    }

    // Update order status if it changed
    if (newOrderStatus && newOrderStatus !== order.status) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: newOrderStatus,
        },
      });

      // Create a record in the status history
      await prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: newOrderStatus,
          notes: `Automatic update based on tracking number: ${trackingInfo.statusDescription || trackingInfo.status}`,
        },
      });

      // Update inventory statuses
      if (newOrderStatus === OrderStatus.DELIVERED) {
        await this.updateInventoryStatus(orderId, InventoryStatus.DELIVERED);
      } else if (newOrderStatus === OrderStatus.RETURNED) {
        await this.updateInventoryStatus(orderId, InventoryStatus.RETURNED);
      }

      // Send notification to the customer
      if (order.user && newOrderStatus === OrderStatus.DELIVERED) {
        try {
          await emailService.sendOrderDelivered(
            orderId,
            order.user.email,
            order.orderNumber,
            order.user.preferredLanguage ?? undefined
          );
        } catch (error) {
          console.error('Failed to send delivery notification:', error);
        }
      }
    }

    // Update delivery information in paymentRequest
    await prisma.paymentRequest.update({
      where: { orderId },
      data: {
        logisticsInfo: {
          ...logisticsInfo,
          lastChecked: new Date().toISOString(),
          currentStatus: trackingInfo.status,
          statusDescription: trackingInfo.statusDescription,
          events: trackingInfo.events,
          estimatedDelivery: trackingInfo.estimatedDelivery,
          deliveredAt: trackingInfo.deliveredAt?.toISOString(),
        },
      },
    });
  }

  /**
   * Update inventory statuses
   */
  private async updateInventoryStatus(
    orderId: string,
    status: InventoryStatus
  ): Promise<void> {
    await prisma.inventoryItem.updateMany({
      where: { orderId },
      data: { status },
    });
  }

  /**
   * Automatic check of all orders with tracking numbers
   */
  async checkAllTrackingNumbers(): Promise<void> {
    const settings = await settingsService.getAllSettings();

    if (!settings.deliveryTrackingEnabled || !settings.deliveryTrackingAutoUpdate) {
      return;
    }

    // Find all orders with status SHIPPED or PROCESSING, which have a tracking number
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.SHIPPED, OrderStatus.PROCESSING],
        },
        paymentRequest: {
          logisticsInfo: {
            path: ['trackingNumber'],
            not: Prisma.JsonNull,
          },
        },
      },
      include: {
        paymentRequest: true,
      },
    });

    for (const order of orders) {
      try {
        await this.updateOrderStatusByTracking(order.id);
      } catch (error) {
        console.error(`Failed to update tracking for order ${order.id}:`, error);
      }
    }
  }

  /**
   * Automatic check of orders that were not received
   */
  async checkNotReceivedOrders(): Promise<void> {
    const settings = await settingsService.getAllSettings();

    if (!settings.deliveryTrackingEnabled || !settings.deliveryTrackingAutoMarkNotReceived) {
      return;
    }

    const daysThreshold = settings.deliveryTrackingNotReceivedDays || 30;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    // Find orders with status SHIPPED, which were sent more than N days ago
    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.SHIPPED,
        paymentRequest: {
          shippedAt: {
            lte: thresholdDate,
          },
        },
      },
      include: {
        paymentRequest: true,
      },
    });

    for (const order of orders) {
      try {
        // Check the tracking number again
        await this.updateOrderStatusByTracking(order.id);

        // If the status is still SHIPPED after checking, mark as not received
        const updatedOrder = await prisma.order.findUnique({
          where: { id: order.id },
        });

        if (updatedOrder?.status === OrderStatus.SHIPPED) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.RETURN_REQUESTED,
            },
          });

          await prisma.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: OrderStatus.RETURN_REQUESTED,
              notes: `Automatically marked as not received after ${daysThreshold} days`,
            },
          });
        }
      } catch (error) {
        console.error(`Failed to check not received order ${order.id}:`, error);
      }
    }
  }
}

export const deliveryTrackingService = new DeliveryTrackingService();
