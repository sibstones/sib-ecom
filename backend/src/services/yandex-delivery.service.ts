import axios, { AxiosInstance } from 'axios';
import { settingsService } from './settings.service';
import { emailService } from './email.service';
import prisma from '../config/database';
import { OrderStatus } from '@prisma/client';

/**
 * Interfaces for working with Yandex Delivery API
 */
export interface YandexCoordinates {
  lat: number;
  lon: number;
}

export interface YandexAddress {
  fullname: string;
  coordinates: YandexCoordinates;
  street?: string;
  building?: string;
  city?: string;
  country?: string;
}

export interface YandexPickupPoint {
  id: string;
  name: string;
  address: string;
  coordinates: YandexCoordinates;
  workingHours?: string;
  phone?: string;
  distance?: number; // Distance in meters
}

export interface YandexDeliveryOffer {
  offer_id: string;
  price: number;
  currency: string;
  estimated_delivery_time?: string;
  pickup_point?: YandexPickupPoint;
}

export interface YandexDeliveryClaim {
  id: string;
  status: string;
  price: number;
  currency: string;
  tracking_url?: string;
  pickup_point?: YandexPickupPoint;
  created_at: string;
  updated_at: string;
}

export interface YandexGeocodeResult {
  coordinates: YandexCoordinates;
  formatted_address: string;
  components: {
    country?: string;
    city?: string;
    street?: string;
    building?: string;
  };
}

/**
 * Service for working with Yandex Delivery API
 */
export class YandexDeliveryService {
  private apiBaseUrl = 'https://b2b.taxi.yandex.net';
  private geocoderApiUrl = 'https://geocode-maps.yandex.ru/v1/';
  private client: AxiosInstance | null = null;

  /**
   * Initialize API client
   */
  private async getClient(): Promise<AxiosInstance> {
    if (this.client) {
      return this.client;
    }

    const settings = await settingsService.getAllSettings();
    
    if (!settings.yandexDeliveryEnabled) {
      throw new Error('Yandex Delivery is not enabled');
    }

    if (!settings.yandexDeliveryApiToken) {
      throw new Error('Yandex Delivery API token is not configured');
    }

    this.client = axios.create({
      baseURL: this.apiBaseUrl,
      headers: {
        'Authorization': `Bearer ${settings.yandexDeliveryApiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    return this.client;
  }

  /**
   * Geocoding address through Yandex Geocoder API v1.
   * Requires API key: developer.tech.yandex.com → Geocoder → Create key.
   */
  async geocodeAddress(address: string, city?: string, country: string = 'RU'): Promise<YandexGeocodeResult> {
    const settings = await settingsService.getAllSettings();
    const apiKey = settings.yandexGeocoderApiKey?.trim();

    if (!apiKey) {
      throw new Error(
        'For geocoding, you need a Yandex Geocoder API key. Add yandexGeocoderApiKey to settings (Settings → Delivery) or in .env. Get key: developer.tech.yandex.com → Geocoder.'
      );
    }

    let fullAddress = address;
    if (city) {
      fullAddress = `${city}, ${address}`;
    }
    if (country === 'RU') {
      fullAddress = `${fullAddress}, Russia`;
    }

    try {
      const params: Record<string, string | number> = {
        apikey: apiKey,
        geocode: fullAddress,
        lang: 'ru_RU',
        format: 'json',
        results: 1,
      };

      const response = await axios.get(this.geocoderApiUrl, { params });
      const collection = response.data?.response?.GeoObjectCollection;
      const featureMember = collection?.featureMember?.[0] ?? collection?.feature_member?.[0];

      if (!featureMember) {
        throw new Error(`Address not found: ${fullAddress}`);
      }

      const geoObject = featureMember.GeoObject;
      const posStr = geoObject.Point?.pos || geoObject.Point?.Pos;
      if (!posStr) {
        throw new Error('Coordinates not received');
      }

      const pos = String(posStr).trim().split(/\s+/);
      const a = parseFloat(pos[0]);
      const b = parseFloat(pos[1]);
      // Yandex Geocoder v1: Point.pos = "lat lon" (example: "55.75 37.62" for Moscow)
      const coordinates: YandexCoordinates = { lat: a, lon: b };

      const metaData = geoObject.metaDataProperty?.GeocoderMetaData;
      const addr = metaData?.Address;
      const components = addr?.Components || [];
      const locality = components.find((c: { kind?: string }) => c.kind === 'locality')?.name;
      const street = components.find((c: { kind?: string }) => c.kind === 'street')?.name;
      const house = components.find((c: { kind?: string }) => c.kind === 'house')?.name;

      return {
        coordinates,
        formatted_address: metaData?.text || addr?.formatted || fullAddress,
        components: {
          country: addr?.country_code || country,
          city: locality || city,
          street: street || addr?.street,
          building: house || addr?.house,
        },
      };
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Unknown error';
      const status = error?.response?.status;
      if (status === 400 && (msg.includes('apikey') || msg.includes('Missing'))) {
        throw new Error(
          'Yandex Geocoder API key is not set or invalid. Add yandexGeocoderApiKey to settings. developer.tech.yandex.com → Geocoder.'
        );
      }
      if (status === 403) {
        throw new Error('Invalid Yandex Geocoder API key. Check the key in settings.');
      }
      console.error('Geocoding error:', error);
      throw new Error(`Geocoding error: ${msg}`);
    }
  }

  /**
    * Search for nearest pickup points by coordinates
   * Note: Yandex Delivery does not provide a public API for searching pickup points,
   * so we use an alternative approach through a map or cached data
   */
  async findNearestPickupPoints(
    coordinates: YandexCoordinates,
    radius: number = 5000
  ): Promise<YandexPickupPoint[]> {
    // In a real implementation, here should be a request to the Yandex Delivery API
    // or using a map of pickup points: https://dostavka.yandex.ru/pickup-point/
    
    // Temporary stub - in production, we need to integrate with the real API
    // or use web scraping of the pickup point map
    
    const settings = await settingsService.getAllSettings();
    
    // If there is a cache of pickup points in the settings, use it
    if (settings.yandexDeliveryPickupPointsCache) {
      try {
        const cachedPoints = JSON.parse(settings.yandexDeliveryPickupPointsCache) as YandexPickupPoint[];
        
        // Filter by radius (simple distance calculation)
        const filteredPoints = cachedPoints
          .map(point => ({
            ...point,
            distance: this.calculateDistance(coordinates, point.coordinates),
          }))
          .filter(point => point.distance! <= radius)
          .sort((a, b) => a.distance! - b.distance!)
          .slice(0, 10); // Take 10 nearest

        return filteredPoints;
      } catch (error) {
        console.error('Error parsing cached pickup points:', error as Error);
      }
    }

    // If there is no cache, return an empty array
    // In production, here should be integration with the real API
    return [];
  }

  /**
   * Calculate distance between two points (haversine formula)
   */
  private calculateDistance(point1: YandexCoordinates, point2: YandexCoordinates): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lon - point1.lon);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.lat)) *
        Math.cos(this.toRad(point2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate delivery cost
   */
  async calculateDeliveryCost(
    fromAddress: YandexAddress,
    toAddress: YandexAddress,
    items: Array<{ weight: number; dimensions?: { length: number; width: number; height: number } }>,
    pickupPointId?: string
  ): Promise<YandexDeliveryOffer[]> {
    const client = await this.getClient();
    await settingsService.getAllSettings();

    try {
      // Form a request to calculate the cost
      const requestBody: any = {
        route_points: [
          {
            address: fromAddress.fullname,
            coordinates: fromAddress.coordinates,
          },
          pickupPointId
            ? {
                pickup_point_id: pickupPointId,
              }
            : {
                address: toAddress.fullname,
                coordinates: toAddress.coordinates,
              },
        ],
        requirements: {
          cargo_type: 'clothing', // Cargo type
          cargo_loaders: 0, // Number of loaders
        },
      };

      // Add information about the cargo
      if (items.length > 0) {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        requestBody.requirements.cargo_weight = totalWeight;

        // If there are dimensions, calculate the volume
        const hasDimensions = items.some(item => item.dimensions);
        if (hasDimensions) {
          const totalVolume = items.reduce((sum, item) => {
            if (item.dimensions) {
              return sum + item.dimensions.length * item.dimensions.width * item.dimensions.height;
            }
            return sum;
          }, 0);
          requestBody.requirements.cargo_volume = totalVolume / 1000000; // Convert to m³
        }
      }

      const response = await client.post('/b2b/cargo/integration/v2/offers/calculate', requestBody);

      if (!response.data?.offers || response.data.offers.length === 0) {
        return [];
      }

      return response.data.offers.map((offer: any) => ({
        offer_id: offer.offer_id,
        price: offer.price,
        currency: offer.currency || 'RUB',
        estimated_delivery_time: offer.estimated_delivery_time,
        pickup_point: offer.pickup_point,
      }));
    } catch (error) {
      console.error('Error calculating delivery cost:', error);
      throw new Error(`Failed to calculate delivery cost: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a delivery order
   */
  async createDeliveryClaim(
    orderId: string,
    fromAddress: YandexAddress,
    toAddress: YandexAddress,
    items: Array<{
      name: string;
      weight: number;
      cost_value: number;
      cost_currency: string;
      dimensions?: { length: number; width: number; height: number };
    }>,
    pickupPointId?: string,
    offerId?: string
  ): Promise<YandexDeliveryClaim> {
    const client = await this.getClient();
    const settings = await settingsService.getAllSettings();

    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          shippingAddress: true,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Form a request to create a claim
      const requestBody: any = {
        request_id: `order_${orderId}_${Date.now()}`,
        items: items.map(item => ({
          title: item.name,
          cost_value: item.cost_value,
          cost_currency: item.cost_currency,
          weight: item.weight,
          ...(item.dimensions && {
            size: {
              length: item.dimensions.length,
              width: item.dimensions.width,
              height: item.dimensions.height,
            },
          }),
        })),
        route_points: [
          {
            address: fromAddress.fullname,
            coordinates: fromAddress.coordinates,
            contact: {
              name: settings.yandexDeliverySenderName || 'Sender',
              phone: settings.yandexDeliverySenderPhone || '',
            },
          },
          pickupPointId
            ? {
                pickup_point_id: pickupPointId,
              }
            : {
                address: toAddress.fullname,
                coordinates: toAddress.coordinates,
                contact: {
                  name: order.shippingAddress
                    ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
                    : order.user.firstName || 'Recipient',
                  phone: order.shippingAddress?.phone || order.user.phone || '',
                },
              },
        ],
        ...(offerId && { offer_id: offerId }),
      };

      const response = await client.post('/b2b/cargo/integration/v2/claims/create', requestBody);

      const claimId = response.data?.id || response.data?.claim_id;
      
      if (!claimId) {
        throw new Error('Failed to create delivery claim: no claim ID in response');
      }

      // Save information about the delivery in the order
      await prisma.order.update({
        where: { id: orderId },
        data: {
          notes: order.notes
            ? `${order.notes}\n\nYandex Delivery Claim ID: ${claimId}`
            : `Yandex Delivery Claim ID: ${claimId}`,
        },
      });

      // Save information about the delivery in paymentRequest.logisticsInfo if it exists
      const paymentRequest = await prisma.paymentRequest.findFirst({
        where: { orderId },
      });

      if (paymentRequest) {
        const logisticsInfo = (paymentRequest.logisticsInfo as any) || {};
        const updatedLogisticsInfo: any = {
          ...logisticsInfo,
          yandexDeliveryClaimId: claimId,
          carrier: 'YANDEX_DELIVERY',
          trackingNumber: claimId,
          pickupPointId,
          trackingUrl: response.data?.tracking_url,
        };

        // Save information about the pickup point if it exists
        if (response.data?.pickup_point) {
          updatedLogisticsInfo.pickupPoint = {
            id: response.data.pickup_point.id,
            name: response.data.pickup_point.name,
            address: response.data.pickup_point.address,
            workingHours: response.data.pickup_point.working_hours,
            phone: response.data.pickup_point.phone,
            coordinates: response.data.pickup_point.coordinates,
          };
        }

        await prisma.paymentRequest.update({
          where: { id: paymentRequest.id },
          data: {
            logisticsInfo: updatedLogisticsInfo,
          },
        });
      }

      return {
        id: claimId,
        status: response.data?.status || 'new',
        price: response.data?.price || 0,
        currency: response.data?.currency || 'RUB',
        tracking_url: response.data?.tracking_url,
        pickup_point: response.data?.pickup_point,
        created_at: response.data?.created_at || new Date().toISOString(),
        updated_at: response.data?.updated_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error creating delivery claim:', error);
      throw new Error(`Failed to create delivery claim: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get information about the delivery claim
   */
  async getClaimInfo(claimId: string): Promise<YandexDeliveryClaim> {
    const client = await this.getClient();

    try {
      const response = await client.get(`/b2b/cargo/integration/v2/claims/info`, {
        params: {
          claim_id: claimId,
        },
      });

      return {
        id: claimId,
        status: response.data?.status || 'unknown',
        price: response.data?.price || 0,
        currency: response.data?.currency || 'RUB',
        tracking_url: response.data?.tracking_url,
        pickup_point: response.data?.pickup_point,
        created_at: response.data?.created_at || new Date().toISOString(),
        updated_at: response.data?.updated_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting claim info:', error);
      throw new Error(`Failed to get claim info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Confirm the delivery claim
   */
  async acceptClaim(claimId: string): Promise<void> {
    const client = await this.getClient();

    try {
      await client.post(`/b2b/cargo/integration/v2/claims/accept`, {
        claim_id: claimId,
      });
    } catch (error) {
      console.error('Error accepting claim:', error);
      throw new Error(`Failed to accept claim: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update the order status based on the Yandex Delivery status
   */
  async updateOrderStatusFromClaim(claimId: string, orderId: string): Promise<void> {
    try {
      const claim = await this.getClaimInfo(claimId);
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          shippingAddress: true,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      let newStatus: OrderStatus | null = null;

      // Mapping Yandex Delivery statuses to order statuses
      switch (claim.status) {
        case 'new':
        case 'estimating':
        case 'estimating_failed':
          newStatus = OrderStatus.PROCESSING;
          break;
        case 'ready_for_approval':
        case 'accepted':
        case 'performer_lookup':
        case 'performer_draft':
        case 'performer_found':
        case 'pickup_arrived':
        case 'ready_for_pickup_confirmation':
        case 'pickuped':
        case 'delivery_arrived':
        case 'ready_for_delivery_confirmation':
          newStatus = OrderStatus.SHIPPED;
          break;
        case 'delivered':
        case 'delivered_finish':
          newStatus = OrderStatus.DELIVERED;
          break;
        case 'cancelled':
        case 'cancelled_by_taxi':
        case 'cancelled_with_payment':
          newStatus = OrderStatus.CANCELLED;
          break;
        case 'returning':
        case 'returned':
        case 'returned_finish':
          newStatus = OrderStatus.RETURNED;
          break;
        default:
            // Status did not change
          return;
      }

      if (newStatus && newStatus !== order.status) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: newStatus },
        });

        // Create a record in the status history
        await prisma.orderStatusHistory.create({
          data: {
            orderId,
            status: newStatus,
            notes: `Yandex Delivery status: ${claim.status}`,
          },
        });

        // Send a notification to the user about delivery
        if (newStatus === OrderStatus.DELIVERED && order.user.email) {
          try {
            await emailService.sendOrderDeliveredEmail(order.user.email, {
              orderNumber: order.orderNumber,
              trackingUrl: claim.tracking_url,
              pickupPoint: claim.pickup_point,
            });
          } catch (emailError) {
            console.error('Error sending delivery email:', emailError);
          }
        }
      }
    } catch (error) {
      console.error('Error updating order status from claim:', error);
      throw error;
    }
  }

  /**
   * Send a notification to the user about the possibility of picking up the order from the pickup point
   */
  async notifyUserAboutPickupPoint(
    orderId: string,
    pickupPoint: YandexPickupPoint
  ): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          shippingAddress: true,
        },
      });

      if (!order || !order.user.email) {
        return;
      }

      // Send an email with information about the pickup point
      await emailService.sendPickupPointNotificationEmail(order.user.email, {
        orderNumber: order.orderNumber,
        pickupPoint: {
          name: pickupPoint.name,
          address: pickupPoint.address,
          workingHours: pickupPoint.workingHours,
          phone: pickupPoint.phone,
        },
      });
    } catch (error) {
      console.error('Error sending pickup point notification:', error);
      throw error;
    }
  }
}

// Create an instance of the service with error handling
let yandexDeliveryServiceInstance: YandexDeliveryService | null = null;

try {
  yandexDeliveryServiceInstance = new YandexDeliveryService();
} catch (error) {
  console.error('Error creating YandexDeliveryService:', error);
  throw error;
}

export const yandexDeliveryService = yandexDeliveryServiceInstance;
