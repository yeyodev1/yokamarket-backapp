/** Todo el dinero se guarda en centavos (enteros) para no arrastrar errores de coma flotante. */

export function toCents(usd: number): number {
  return Math.round(usd * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatUsd(cents: number): string {
  return `$${fromCents(cents).toFixed(2)}`;
}
