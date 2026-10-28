import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para dictarlo por teléfono

function randomToken(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Código corto del pedido que ve el cliente: YK-7F3KQ2. */
export function orderCode(): string {
  return `YK-${randomToken(6)}`;
}

/**
 * Identificador único por intento de pago. Payphone exige que no se repita
 * nunca por tienda, por eso lleva timestamp + aleatorio.
 */
export function clientTransactionId(): string {
  return `YK${Date.now().toString(36).toUpperCase()}${randomToken(6)}`;
}
