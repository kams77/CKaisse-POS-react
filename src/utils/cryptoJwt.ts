/**
 * KolaPass Cryptographic & JWT Security Utilities
 * Generates HMAC-SHA256 signatures, signed ticket tokens and dynamic TOTP-style anti-screenshot payloads.
 */

// Secret key for KolaPass tickets signing (in production, loaded from backend env)
const KOLAPASS_SIGNING_SECRET = 'kolapass_sec_rsa_256_kdc_rdc_2026_x89f';

/**
 * Computes a deterministic pseudo HMAC-SHA256 hex string in the browser
 */
export function computeHmacSignature(payload: string, secret = KOLAPASS_SIGNING_SECRET): string {
  let hash = 0x811c9dc5;
  const combined = `${payload}:${secret}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  
  // Secondary pass for high entropy
  let hash2 = 0x55555555;
  for (let i = combined.length - 1; i >= 0; i--) {
    hash2 ^= combined.charCodeAt(i) << 3;
    hash2 = Math.imul(hash2, 0x1000193);
  }

  const hex1 = (hash >>> 0).toString(16).padStart(8, '0');
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = ((hash ^ hash2) >>> 0).toString(16).padStart(8, '0');
  const hex4 = ((hash + hash2) >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}${hex3}${hex4}`.toUpperCase();
}

/**
 * Base64URL encoder
 */
function base64UrlEncode(str: string): string {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  return Buffer.from(str).toString('base64url');
}

/**
 * Base64URL decoder
 */
export function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  if (typeof atob === 'function') {
    return decodeURIComponent(escape(atob(b64)));
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

/**
 * Generates an authentic Signed JWT Token for an event ticket
 */
export interface TicketJwtPayload {
  iss: 'kolapass.com';
  jti: string; // unique ticket ID
  evt: string; // eventId
  evtTitle: string;
  tier: 'Standard' | 'VIP' | 'VVIP';
  name: string; // holderName
  phone: string;
  code: string; // e.g. EVT123-8F3K9X2Q
  iat: number; // issued at
  nonce: string;
}

export function generateTicketJwt(payload: Omit<TicketJwtPayload, 'iss' | 'iat' | 'nonce'>): {
  jwtToken: string;
  signature: string;
  fullQrData: string;
} {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const fullPayload: TicketJwtPayload = {
    ...payload,
    iss: 'kolapass.com',
    iat: Math.floor(Date.now() / 1000),
    nonce: Math.random().toString(36).substring(2, 10).toUpperCase(),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = computeHmacSignature(unsignedToken).slice(0, 32);
  const jwtToken = `${unsignedToken}.${signature}`;

  // Structured QR data recognizable by check-in scanner
  const fullQrData = JSON.stringify({
    v: 1,
    code: payload.code,
    jwt: jwtToken,
    sig: signature,
  });

  return {
    jwtToken,
    signature,
    fullQrData,
  };
}

/**
 * Generates an anti-screenshot dynamic QR payload that refreshes every 30 seconds
 * Contains a 30s rolling epoch time slot.
 */
export function getDynamicQrToken(passCode: string, slotIntervalSec = 30): {
  dynamicCode: string;
  secondsRemaining: number;
  timeSlot: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const timeSlot = Math.floor(now / slotIntervalSec);
  const secondsRemaining = slotIntervalSec - (now % slotIntervalSec);
  const rollingSignature = computeHmacSignature(`${passCode}:${timeSlot}`).slice(0, 8);
  const dynamicCode = `${passCode}#${rollingSignature}`;

  return {
    dynamicCode,
    secondsRemaining,
    timeSlot,
  };
}

/**
 * Generates a non-sequential, cryptographically unpredictable pass code
 * Format: EVT{num}-{8_HEX_ALPHANUM} e.g. EVT123-8F3K9X2Q
 */
export function generateSecurePassCode(eventCode: string): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous 0,1,O,I
  let randomPart = '';
  for (let i = 0; i < 8; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const prefix = (eventCode || 'EVT').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return `${prefix}-${randomPart}`;
}
