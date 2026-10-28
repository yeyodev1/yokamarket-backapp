import { CustomError } from "../errors/customError.error";

/** Validación mínima a mano: la API es chica y no amerita una librería. */

export function str(value: unknown, field: string, opts: { min?: number; max?: number; required?: boolean } = {}): string {
  const { min = 0, max = 500, required = true } = opts;
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) {
    if (required) throw new CustomError(`${field} es obligatorio`, 400);
    return "";
  }
  if (v.length < min) throw new CustomError(`${field} es demasiado corto`, 400);
  if (v.length > max) throw new CustomError(`${field} es demasiado largo`, 400);
  return v;
}

export function email(value: unknown, required = true): string {
  const v = str(value, "El correo", { required, max: 120 }).toLowerCase();
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
    throw new CustomError("El correo no es válido", 400);
  }
  return v;
}

/** Teléfonos de Ecuador: 09XXXXXXXX o +5939XXXXXXXX. Se guarda en E.164. */
export function phoneEc(value: unknown): string {
  const raw = str(value, "El teléfono", { max: 20 }).replace(/[\s\-().]/g, "");
  const digits = raw.replace(/^\+/, "");
  if (/^09\d{8}$/.test(digits)) return `+593${digits.slice(1)}`;
  if (/^5939\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[2-7]\d{7}$/.test(digits)) return `+593${digits.slice(1)}`;
  throw new CustomError("El teléfono no es válido (ej. 0991234567)", 400);
}

export function int(value: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new CustomError(`${field} debe ser un número entero`, 400);
  if (opts.min !== undefined && n < opts.min) throw new CustomError(`${field} es muy bajo`, 400);
  if (opts.max !== undefined && n > opts.max) throw new CustomError(`${field} es muy alto`, 400);
  return n;
}

export function num(value: unknown, field: string, opts: { min?: number } = {}): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new CustomError(`${field} debe ser un número`, 400);
  if (opts.min !== undefined && n < opts.min) throw new CustomError(`${field} es muy bajo`, 400);
  return n;
}
