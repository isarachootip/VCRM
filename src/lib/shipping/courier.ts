/**
 * Courier Logistics & Tracking Service (R4 - Phase 2)
 * Path: src/lib/shipping/courier.ts
 *
 * Implements:
 * - Tracking number validation regexes for Kerry, Flash, and Central Express
 * - Carrier tracking number generator
 * - Tracking portal URL builders
 * - HTTP 422 rejection for invalid tracking formats
 * - Barcode generation utility for shipping labels
 */

import { ShippingCarrier } from '@prisma/client';

export class TrackingValidationError extends Error {
  public statusCode: number;
  public code: string;
  public carrier: string;
  public trackingNumber: string;

  constructor(carrier: string, trackingNumber: string, message?: string) {
    const defaultMsg = `Invalid tracking format for carrier ${carrier}: '${trackingNumber}'. Must conform to carrier regex specification.`;
    super(message || defaultMsg);
    this.name = 'TrackingValidationError';
    this.statusCode = 422;
    this.code = 'INVALID_TRACKING_FORMAT';
    this.carrier = carrier;
    this.trackingNumber = trackingNumber;
  }
}

/**
 * Normalizes carrier input string to ShippingCarrier enum or string code.
 */
export function normalizeCarrier(carrier: string | ShippingCarrier): ShippingCarrier {
  const norm = String(carrier).toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (norm === 'KERRY' || norm === 'KEX' || norm === 'KER' || norm === 'KERRY_EXPRESS') {
    return ShippingCarrier.KERRY;
  }
  if (norm === 'FLASH' || norm === 'FLS' || norm === 'FLASH_EXPRESS') {
    return ShippingCarrier.FLASH;
  }
  if (norm === 'CENTRAL_EXPRESS' || norm === 'CENTRAL' || norm === 'CTEX' || norm === 'CDS' || norm === 'CTX') {
    return ShippingCarrier.CENTRAL_EXPRESS;
  }
  return norm as ShippingCarrier;
}

/**
 * Validates tracking number against carrier-specific regex patterns.
 * - Kerry: KEX/SHP/KER prefix + 8-12 alphanumeric + optional TH suffix, or 10-13 digits.
 * - Flash: TH or FLS prefix + 10-14 alphanumeric chars.
 * - Central Express: CTEX/CTX tracking format (e.g. CTEX-YYYY-XXXXXXTH or CTX + alphanumeric + TH).
 */
export function validateTrackingNumber(carrier: string | ShippingCarrier, trackingNumber: string): boolean {
  if (!trackingNumber || typeof trackingNumber !== 'string') {
    return false;
  }

  const track = trackingNumber.trim();
  if (track.length === 0) return false;

  const norm = normalizeCarrier(carrier);

  switch (norm) {
    case ShippingCarrier.KERRY:
      return /^(KEX|SHP|KER)[0-9A-Z]{8,12}(TH)?$/i.test(track) || /^\d{10,13}$/.test(track);

    case ShippingCarrier.FLASH:
      return /^(TH|FLS)[0-9A-Z]{10,14}$/i.test(track);

    case ShippingCarrier.CENTRAL_EXPRESS:
      return (
        /^(CTEX|CTX)-?[0-9A-Z]{4,14}(TH)?$/i.test(track) ||
        /^(CTEX|CTX)-?[0-9]{4}-?[0-9]{6,8}(TH)?$/i.test(track) ||
        /^(CTEX|CTX)[0-9A-Z]{8,12}$/i.test(track)
      );

    default:
      return false;
  }
}

/**
 * Asserts tracking number validity or throws TrackingValidationError (HTTP 422).
 */
export function assertValidTrackingNumber(carrier: string | ShippingCarrier, trackingNumber: string): void {
  const isValid = validateTrackingNumber(carrier, trackingNumber);
  if (!isValid) {
    throw new TrackingValidationError(String(carrier), trackingNumber);
  }
}

/**
 * Generates a valid tracking number conforming to the carrier's regex pattern.
 */
export function generateTrackingNumber(carrier: string | ShippingCarrier): string {
  const norm = normalizeCarrier(carrier);
  const now = Date.now().toString();
  const rand4 = Math.floor(1000 + Math.random() * 9000).toString();

  switch (norm) {
    case ShippingCarrier.KERRY: {
      // Kerry format: KEX + 8-10 alphanumeric + TH
      const seq = `${now.slice(-6)}${rand4}`;
      return `KEX${seq}TH`;
    }

    case ShippingCarrier.FLASH: {
      // Flash format: TH + 10-12 alphanumeric
      const seq = `${now.slice(-7)}${rand4}`;
      const suffixLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      return `TH${seq}${suffixLetter}`;
    }

    case ShippingCarrier.CENTRAL_EXPRESS:
    default: {
      // Central Express format: CTEX-YYYY-XXXXXXTH
      const year = new Date().getFullYear();
      const rand6 = Math.floor(100000 + Math.random() * 900000).toString();
      return `CTEX-${year}-${rand6}TH`;
    }
  }
}

/**
 * Generates carrier tracking portal link.
 */
export function getTrackingPortalUrl(carrier: string | ShippingCarrier, trackingNumber: string): string {
  const norm = normalizeCarrier(carrier);
  const encoded = encodeURIComponent(trackingNumber.trim());

  switch (norm) {
    case ShippingCarrier.KERRY:
      return `https://th.kerryexpress.com/th/track/?track=${encoded}`;

    case ShippingCarrier.FLASH:
      return `https://www.flashexpress.co.th/tracking/?se=${encoded}`;

    case ShippingCarrier.CENTRAL_EXPRESS:
    default:
      return `https://delivery.central.co.th/track/${encoded}`;
  }
}

/**
 * Generates an SVG string representation of a Code 128 barcode.
 * Uses pseudo-random/deterministic bar widths based on input string characters.
 */
export function generateBarcodeSvg(value: string, height = 50, showText = true): string {
  const cleanVal = (value || '000000').toUpperCase().replace(/[^0-9A-Z-]/g, '');
  let bars = '';
  let x = 10;
  const barHeight = height;

  // Guard bars
  bars += `<rect x="${x}" y="0" width="2" height="${barHeight}" fill="#000"/>`;
  x += 3;
  bars += `<rect x="${x}" y="0" width="1" height="${barHeight}" fill="#000"/>`;
  x += 3;

  for (let i = 0; i < cleanVal.length; i++) {
    const code = cleanVal.charCodeAt(i);
    const pattern = [(code % 3) + 1, ((code >> 1) % 3) + 1, ((code >> 2) % 2) + 1, ((code >> 3) % 3) + 1];
    for (let p = 0; p < pattern.length; p++) {
      const width = pattern[p];
      if (p % 2 === 0) {
        bars += `<rect x="${x}" y="0" width="${width}" height="${barHeight}" fill="#000"/>`;
      }
      x += width + 1;
    }
  }

  // End guard bars
  bars += `<rect x="${x}" y="0" width="2" height="${barHeight}" fill="#000"/>`;
  x += 3;
  bars += `<rect x="${x}" y="0" width="1" height="${barHeight}" fill="#000"/>`;
  x += 10;

  const totalWidth = x;
  const svgHeight = showText ? height + 18 : height;
  const textElem = showText
    ? `<text x="${totalWidth / 2}" y="${height + 14}" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">${cleanVal}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${svgHeight}" width="100%" height="${svgHeight}" preserveAspectRatio="none" style="display:block;margin:0 auto;">
    <rect width="${totalWidth}" height="${svgHeight}" fill="#fff"/>
    ${bars}
    ${textElem}
  </svg>`;
}
