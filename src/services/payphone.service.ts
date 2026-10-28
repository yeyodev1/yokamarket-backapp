import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";

/**
 * Payphone "Botón de pago por redirección".
 * Docs: https://docs.payphone.app/boton-de-pago-por-redireccion
 *
 * Flujo: Prepare (servidor) → el cliente paga en la página de Payphone →
 * Payphone lo devuelve a FRONTEND_URL/pay-response?id=&clientTransactionId= →
 * Confirm (servidor) dentro de los 5 minutos, si no Payphone reversa el cobro.
 */

const BASE_URL = "https://pay.payphonetodoesposible.com/api";
// La Cajita de pagos (v2.0) confirma en otro host que el botón por redirección.
const BOX_CONFIRM_URL = "https://paymentbox.payphonetodoesposible.com/api/confirm";

export interface PrepareInput {
  totalCents: number;
  clientTransactionId: string;
  reference: string;
  email?: string;
  phoneNumber?: string;
  documentId?: string;
  lineItems?: Array<{ productName: string; unitPrice: number; quantity: number; totalAmount: number }>;
}

export interface PrepareResult {
  paymentId: string;
  payWithCard: string;
  payWithPayPhone: string;
}

export interface ConfirmResult {
  statusCode: number; // 3 aprobada, 2 cancelada
  transactionStatus: string; // "Approved" | "Canceled"
  transactionId: number | null;
  authorizationCode: string;
  clientTransactionId: string;
  amount: number; // centavos
  message: string;
  messageCode: number | null;
  cardBrand: string;
  lastDigits: string;
  email: string;
  phoneNumber: string;
  date: string;
  raw: Record<string, unknown>;
}

function client() {
  if (!env.PAYPHONE_TOKEN) throw new CustomError("Pagos no configurados (falta PAYPHONE_TOKEN)", 503);
  return axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${env.PAYPHONE_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Desglose de impuestos que exige Payphone: amount = amountWithoutTax +
 * amountWithTax + tax + service + tip. Si PAYPHONE_TAX_RATE es 0 todo va
 * como amountWithoutTax; si es 0.15 se separa el IVA incluido en el precio.
 */
export function splitAmount(totalCents: number) {
  const rate = env.PAYPHONE_TAX_RATE;
  if (!rate || rate <= 0) {
    return { amount: totalCents, amountWithoutTax: totalCents, amountWithTax: 0, tax: 0 };
  }
  const amountWithTax = Math.round(totalCents / (1 + rate));
  const tax = totalCents - amountWithTax;
  return { amount: totalCents, amountWithoutTax: 0, amountWithTax, tax };
}

function describeError(error: unknown): { message: string; details: unknown } {
  if (error instanceof AxiosError) {
    const data = error.response?.data as any;
    const apiMessage = data?.message || data?.errors?.[0]?.message || error.message;
    return { message: apiMessage, details: { status: error.response?.status, data } };
  }
  return { message: (error as Error)?.message || "Error desconocido", details: error };
}

export async function prepare(input: PrepareInput): Promise<PrepareResult> {
  const amounts = splitAmount(input.totalCents);
  const body: Record<string, unknown> = {
    ...amounts,
    service: 0,
    tip: 0,
    currency: "USD",
    clientTransactionId: input.clientTransactionId,
    storeId: env.PAYPHONE_STORE_ID || undefined,
    reference: input.reference.slice(0, 100),
    responseUrl: `${env.FRONTEND_URL}/pay-response`,
    // Payphone no agrega parámetros al cancelar: los ponemos nosotros.
    cancellationUrl: `${env.FRONTEND_URL}/pay-response?cancelled=1&clientTransactionId=${encodeURIComponent(input.clientTransactionId)}`,
    lang: "es",
    timeZone: -5,
  };
  if (input.email) body.email = input.email;
  if (input.phoneNumber) body.phoneNumber = input.phoneNumber;
  if (input.documentId) body.documentId = input.documentId;
  if (input.lineItems?.length) body.order = { lineItems: input.lineItems };

  try {
    const { data } = await client().post("/button/Prepare", body);
    if (!data?.paymentId || !data?.payWithCard) {
      throw new CustomError("Payphone no devolvió un enlace de pago", 502, data);
    }
    return {
      paymentId: String(data.paymentId),
      payWithCard: String(data.payWithCard),
      payWithPayPhone: String(data.payWithPayPhone || ""),
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    const { message, details } = describeError(error);
    console.error("[payphone] Prepare falló:", message, JSON.stringify(details));
    throw new CustomError("No pudimos iniciar el pago con Payphone. Intenta de nuevo.", 502, details);
  }
}

function parseConfirm(data: any): ConfirmResult {
  return {
    statusCode: Number(data?.statusCode ?? 0),
      transactionStatus: String(data?.transactionStatus || ""),
      transactionId: data?.transactionId != null ? Number(data.transactionId) : null,
      authorizationCode: String(data?.authorizationCode || ""),
      clientTransactionId: String(data?.clientTransactionId || ""),
      amount: Number(data?.amount ?? 0),
      message: String(data?.message || ""),
      messageCode: data?.messageCode != null ? Number(data.messageCode) : null,
      cardBrand: String(data?.cardBrand || ""),
      lastDigits: String(data?.lastDigits || ""),
      email: String(data?.email || ""),
      phoneNumber: String(data?.phoneNumber || ""),
      date: String(data?.date || ""),
      raw: data,
  };
}

/**
 * Confirma primero en el endpoint del modo configurado y, si Payphone dice que
 * la transacción no existe ahí (errorCode 20), prueba el otro: así un pedido
 * creado con la cajita y otro con redirección se confirman igual.
 */
export async function confirm(id: number, clientTxId: string): Promise<ConfirmResult> {
  const http = client();
  const endpoints =
    env.PAYPHONE_MODE === "redirect"
      ? [`${BASE_URL}/button/V2/Confirm`, BOX_CONFIRM_URL]
      : [BOX_CONFIRM_URL, `${BASE_URL}/button/V2/Confirm`];

  let lastError: unknown = null;
  for (const url of endpoints) {
    try {
      const { data } = await http.post(url, { id, clientTxId });
      return parseConfirm(data);
    } catch (error) {
      lastError = error;
      const code = (error as AxiosError).response?.data as any;
      const notFound = (error as AxiosError).response?.status === 404 || code?.errorCode === 20;
      if (!notFound) break;
    }
  }
  const { message, details } = describeError(lastError);
  console.error("[payphone] Confirm falló:", message, JSON.stringify(details));
  throw new CustomError("No pudimos confirmar el pago con Payphone.", 502, details);
}

export function isApproved(result: ConfirmResult): boolean {
  return result.statusCode === 3 && result.transactionStatus.toLowerCase() === "approved";
}
