// src/lib/api.ts — appels au serveur KolaPass (session par cookie sécurisé).
import type { AccessLogEntry, EventTicketPass, OrganizerPayout, TicketBatchRange, TicketingEvent, UserRole } from '../types';

export interface ServerUser {
  id: string;
  name: string;
  login: string;
  phone: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  lockedUntil?: number;
  lastLoginAt?: string;
  createdAt: string;
}

export interface PromoCode { code: string; percent: number; active?: boolean }

export interface ServerSettings {
  organizationName: string;
  phone?: string;
  defaultCommissionPercent?: number;
  maxDiscountPercent?: number;
  promoCodes?: PromoCode[];
  gates?: string[];
  rates: { USD: number; CDF: number; XOF: number; EUR: number };
  ratesUpdatedAt?: string | null;
}

export interface AuditEntry { id: string; at: string; userName: string; action: string; details: string }

export interface ServerState {
  version: number;
  settings: ServerSettings;
  events: TicketingEvent[];
  batches: TicketBatchRange[];
  passes: EventTicketPass[];
  logs: AccessLogEntry[];
  payouts: OrganizerPayout[];
  users: ServerUser[];
  audit: AuditEntry[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const SESSION_EXPIRED_EVENT = 'kolapass:session-expired';

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        'X-Requested-With': 'kolapass',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Serveur injoignable : vérifiez le réseau.');
  }
  let json: any = null;
  try { json = await res.json(); } catch { /* réponse vide */ }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError(res.status, json?.error || `Erreur ${res.status}`);
  }
  return json as T;
}

/** Opération métier : renvoie `result` (le serveur renvoie { result, version }). */
export async function op<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await api<{ result: T }>(method, url, body ?? {});
  return r.result;
}
