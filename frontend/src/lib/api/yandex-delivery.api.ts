import { apiClient } from './client';

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
  distance?: number;
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

export const yandexDeliveryApi = {
  /**
   * Geocoding address
   */
  geocodeAddress: (address: string, city?: string, country?: string) =>
    apiClient.post<{ result: YandexGeocodeResult }>('/yandex-delivery/geocode', {
      address,
      city,
      country: country || 'RU',
    }),

  /**
   * Search for nearest pickup points
   */
  findNearestPickupPoints: (coordinates: YandexCoordinates, radius?: number) =>
    apiClient.post<{ pickupPoints: YandexPickupPoint[] }>('/yandex-delivery/pickup-points', {
      lat: coordinates.lat,
      lon: coordinates.lon,
      radius: radius || 5000,
    }),

  /**
   * Calculate delivery cost
   */
  calculateDeliveryCost: (
    fromAddress: YandexAddress,
    toAddress: YandexAddress,
    items: Array<{
      weight: number;
      dimensions?: { length: number; width: number; height: number };
    }>,
    pickupPointId?: string
  ) =>
    apiClient.post<{ offers: YandexDeliveryOffer[] }>('/yandex-delivery/calculate', {
      fromAddress,
      toAddress,
      items,
      pickupPointId,
    }),

  /**
   * Create a delivery order
   */
  createDeliveryClaim: (
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
  ) =>
    apiClient.post<{ claim: YandexDeliveryClaim }>('/yandex-delivery/claims/create', {
      orderId,
      fromAddress,
      toAddress,
      items,
      pickupPointId,
      offerId,
    }),

  /**
   * Get information about the delivery claim
   */
  getClaimInfo: (claimId: string) =>
    apiClient.get<{ claim: YandexDeliveryClaim }>(`/yandex-delivery/claims/${claimId}`),

  /**
   * Confirm the delivery claim
   */
  acceptClaim: (claimId: string) =>
    apiClient.post<{ message: string }>(`/yandex-delivery/claims/${claimId}/accept`),

  /**
   * Update the order status based on the delivery status
   */
  updateOrderStatusFromClaim: (claimId: string, orderId: string) =>
    apiClient.post<{ message: string }>('/yandex-delivery/claims/update-order-status', {
      claimId,
      orderId,
    }),

  /**
   * Send a notification to the user about the pickup point
   */
  notifyUserAboutPickupPoint: (orderId: string, pickupPoint: YandexPickupPoint) =>
    apiClient.post<{ message: string }>('/yandex-delivery/notify-pickup-point', {
      orderId,
      pickupPoint,
    }),
};
