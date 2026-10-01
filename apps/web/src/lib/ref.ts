// No 0/1/O/I: the code is read out and typed by people.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Short reference code appended to WhatsApp/SMS messages so the shop can match a conversation with
 * the click that started it. Works in both the browser (WhatsAppLink) and the server (the QR-code
 * redirect route): both environments expose the Web Crypto API globally.
 */
export function makeRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
