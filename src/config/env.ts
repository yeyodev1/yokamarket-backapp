import "dotenv/config";

/**
 * Único lugar que lee process.env. Leerlo en otro archivo a nivel de módulo
 * es el bug clásico de "la variable está en .env pero llega undefined".
 */

function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function list(key: string): string[] {
  return optional(key, "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export const env = {
  PORT: Number(optional("PORT", "8100")),
  NODE_ENV: optional("NODE_ENV", "development"),
  IS_VERCEL: Boolean(process.env.VERCEL),
  DB_URI: required("DB_URI"),
  JWT_SECRET: required("JWT_SECRET"),
  CORS_ORIGINS: list("CORS_ORIGINS"),
  FRONTEND_URL: optional("FRONTEND_URL", "http://localhost:5173").replace(/\/+$/, ""),
  SLACK_ERROR_WEBHOOK: optional("SLACK_ERROR_WEBHOOK", ""),
  ADMIN_EMAIL: optional("ADMIN_EMAIL", "admin@yokamarket.ec").toLowerCase(),
  ADMIN_PASSWORD: optional("ADMIN_PASSWORD", ""),
  ADMIN_NAME: optional("ADMIN_NAME", "YOKA Market"),
  PAYPHONE_TOKEN: optional("PAYPHONE_TOKEN", ""),
  PAYPHONE_STORE_ID: optional("PAYPHONE_STORE_ID", ""),
  PAYPHONE_TAX_RATE: Number(optional("PAYPHONE_TAX_RATE", "0")),
  // "box": Cajita de pagos incrustada en la tienda (confirma en paymentbox.…/api/confirm).
  // "redirect": Botón de pago por redirección (Prepare + pay.…/api/button/V2/Confirm).
  PAYPHONE_MODE: optional("PAYPHONE_MODE", "box") as "box" | "redirect",
  // Cloudinary: subida de fotos desde el panel (opcional; sin esto el panel solo acepta enlaces).
  CLOUDINARY_CLOUD_NAME: optional("CLOUDINARY_CLOUD_NAME", ""),
  CLOUDINARY_API_KEY: optional("CLOUDINARY_API_KEY", ""),
  CLOUDINARY_API_SECRET: optional("CLOUDINARY_API_SECRET", ""),
  RESEND_API_KEY: optional("RESEND_API_KEY", ""),
  RESEND_FROM_EMAIL: optional("RESEND_FROM_EMAIL", "YOKA Market <onboarding@resend.dev>"),
  NOTIFY_EMAIL: optional("NOTIFY_EMAIL", ""),
} as const;
