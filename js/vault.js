// Coffre des affaires privées (grilles du livre) : chiffrées par mot de passe,
// seul le fichier chiffré est publié. Partagé navigateur et node (Web Crypto).
// AES-GCM 256, clé tirée du mot de passe par PBKDF2-SHA256.

export const ITERATIONS = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const fromB64 = b64 => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));

/** Majuscules et espaces autour ignorés : le clavier du téléphone met souvent une majuscule. */
export const normalize = password => password.trim().toLowerCase();

/** Clé AES tirée du mot de passe (lent exprès : environ une seconde sur téléphone). */
export async function deriveKey(password, salt, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalize(password)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  );
}

export const exportKey = async key => toB64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
export const importKey = b64 => crypto.subtle.importKey('raw', fromB64(b64), 'AES-GCM', true, ['decrypt']);

/** Chiffre un objet JSON. Le sel est réutilisable pour qu'une clé mémorisée reste valable. */
export async function seal(data, key, salt, iterations = ITERATIONS) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations, salt: toB64(salt), iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

/** Déchiffre ; échoue (exception) si la clé n'est pas la bonne. */
export async function open(box, key) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.data));
  return JSON.parse(dec.decode(pt));
}
