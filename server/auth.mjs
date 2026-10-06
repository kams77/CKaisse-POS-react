// server/auth.mjs — mots de passe (PBKDF2), jetons de session, signature des billets (HMAC-SHA256).
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(crypto.pbkdf2);
const ITERATIONS = 150_000;

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000; // une journée d'événement
export const SESSION_MAX_MS = 24 * 60 * 60 * 1000;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await pbkdf2(String(password), salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2-sha256$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string' || !stored.startsWith('pbkdf2-sha256$')) return false;
  const [, iter, saltB64, hashB64] = stored.split('$');
  const expected = Buffer.from(hashB64, 'base64');
  const got = await pbkdf2(password, Buffer.from(saltB64, 'base64'), Number(iter), expected.length, 'sha256');
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

let dummy;
/** Même durée de calcul quand l'identifiant n'existe pas (on ne révèle pas les comptes existants). */
export async function burnTime(password) {
  dummy ??= await hashPassword('kolapass-dummy-password');
  await verifyPassword(String(password ?? ''), dummy);
}

export function passwordProblem(password, login = '') {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (password.length > 200) return 'Mot de passe trop long.';
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  const lower = password.toLowerCase();
  if (['password', 'motdepasse', '1234567890', 'azerty', 'kolapass'].some(w => lower.includes(w))) return 'Mot de passe trop courant.';
  const id = String(login).split('@')[0].toLowerCase();
  if (id.length >= 3 && lower.includes(id)) return 'Le mot de passe ne doit pas contenir votre identifiant.';
  return null;
}

/** Mot de passe provisoire lisible (remis à la personne, à changer à la 1re connexion). */
export function temporaryPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pick = (s, n) => Array.from(crypto.randomBytes(n), b => s[b % s.length]).join('');
  return `${pick(alphabet, 4)}-${pick(digits, 4)}-${pick(alphabet, 3)}`;
}

export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Code de billet imprévisible : PRÉFIXE-XXXXXXXXXX (10 caractères, ~50 bits). */
export function randomPassCode(prefix) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans 0/O ni 1/I
  const clean = String(prefix || 'KP').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'KP';
  return `${clean}-${Array.from(crypto.randomBytes(10), b => alphabet[b % 32]).join('')}`;
}

/** Signature HMAC-SHA256 d'un billet (code + événement + catégorie). */
export function signPass(secret, pass) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${pass.passCode}|${pass.eventId}|${pass.tierName}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyPassSignature(secret, pass, signature) {
  return typeof signature === 'string' && safeEqual(signPass(secret, pass), signature.toLowerCase());
}
