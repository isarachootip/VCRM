/**
 * Authoritative Type Definitions for Courier Tracking & LINE Notifications (R2 - Phase 3)
 * Path: src/lib/shipping/types.ts
 */

export type CourierCarrier = 'KERRY' | 'FLASH';

export type CourierStatus =
  | 'PACKED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED';

export const VALID_CARRIERS: readonly CourierCarrier[] = ['KERRY', 'FLASH'] as const;

export const VALID_STATUSES: readonly CourierStatus[] = [
  'PACKED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
] as const;

export interface CourierWebhookPayload {
  trackingNumber: string;
  orderId?: string;
  orderNumber?: string;
  carrier: string;
  status: string;
  statusCode?: string;
  location?: string | null;
  description?: string | null;
  notes?: string | null;
  estimatedDelivery?: string | Date | null;
  timestamp?: string | Date;
  metadata?: Record<string, any> | null;
}

export interface CourierWebhookResponse {
  success: boolean;
  eventId?: string;
  status: string;
  trackingNumber: string;
  carrier: string;
  orderId?: string;
  duplicate?: boolean;
  message?: string;
}

export interface TrackingTimelineEvent {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  statusCode?: string | null;
  location?: string | null;
  description?: string | null;
  estimatedDelivery?: string | null;
  timestamp: string;
  createdAt?: string;
}

export interface TrackingTimelineResponse {
  success: boolean;
  trackingNumber: string;
  carrier?: string;
  status?: string;
  events: TrackingTimelineEvent[];
}

// =========================================================================
// Error Definitions
// =========================================================================

export class TrackingServiceError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 400, code = 'TRACKING_SERVICE_ERROR', details?: any) {
    super(message);
    this.name = 'TrackingServiceError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class CarrierValidationError extends TrackingServiceError {
  constructor(carrier: string, message?: string) {
    super(
      message || `INVALID_CARRIER: Invalid carrier code '${carrier}'. Supported carriers: KERRY, FLASH`,
      422,
      'INVALID_CARRIER',
      { carrier }
    );
  }
}

export class MissingTrackingNumberError extends TrackingServiceError {
  constructor(message?: string) {
    super(
      message || 'MISSING_TRACKING_NUMBER: trackingNumber is required and cannot be empty',
      400,
      'MISSING_TRACKING_NUMBER'
    );
  }
}

export class InvalidStatusError extends TrackingServiceError {
  constructor(status: string, message?: string) {
    super(
      message || `INVALID_STATUS: Invalid shipping status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}`,
      400,
      'INVALID_STATUS',
      { status, validStatuses: VALID_STATUSES }
    );
  }
}

export class CourierSignatureError extends TrackingServiceError {
  constructor(message?: string) {
    super(
      message || 'INVALID_SIGNATURE: Courier HMAC signature verification failed or signature header is invalid',
      401,
      'INVALID_SIGNATURE'
    );
  }
}

export class TrackingNotFoundError extends TrackingServiceError {
  constructor(trackingNumber: string) {
    super(
      `TRACKING_NOT_FOUND: No shipping fulfillment record found for tracking number '${trackingNumber}'`,
      404,
      'TRACKING_NOT_FOUND',
      { trackingNumber }
    );
  }
}
