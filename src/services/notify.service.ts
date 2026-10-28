import { Resend } from "resend";
import { env } from "../config/env";
import { IOrder } from "../models/order.model";
import { formatUsd } from "../utils/money";

/**
 * Aviso a la tienda cuando entra un pedido pagado. Sin RESEND_API_KEY o sin
 * NOTIFY_EMAIL no hace nada: el panel admin sigue siendo la fuente de verdad.
 */
export async function notifyPaidOrder(order: IOrder): Promise<void> {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return;

  const rows = order.items
    .map((i) => `<tr><td>${i.qty} × ${i.name}</td><td align="right">${formatUsd(i.subtotalCents)}</td></tr>`)
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px">
      <h2 style="margin:0 0 4px">Nuevo pedido pagado · ${order.code}</h2>
      <p style="margin:0 0 16px;color:#555">Payphone aprobó el cobro (${order.payment.authorizationCode || "s/n"}).</p>
      <table style="width:100%;border-collapse:collapse">${rows}
        <tr><td style="padding-top:8px"><b>Envío</b></td><td align="right" style="padding-top:8px">${formatUsd(order.deliveryFeeCents)}</td></tr>
        <tr><td><b>Total</b></td><td align="right"><b>${formatUsd(order.totalCents)}</b></td></tr>
      </table>
      <h3>Cliente</h3>
      <p>${order.customer.name}<br>${order.customer.phone}<br>${order.customer.email || ""}</p>
      <h3>Entrega</h3>
      <p>${order.delivery.address}${order.delivery.sector ? ", " + order.delivery.sector : ""}${order.delivery.city ? ", " + order.delivery.city : ""}<br>
      ${order.delivery.reference ? "Ref: " + order.delivery.reference + "<br>" : ""}
      ${order.delivery.notes ? "Notas: " + order.delivery.notes : ""}</p>
    </div>`;

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: env.NOTIFY_EMAIL.split(",").map((e) => e.trim()),
      subject: `Pedido pagado ${order.code} · ${formatUsd(order.totalCents)} · ${order.customer.name}`,
      html,
    });
  } catch (error) {
    // Un correo caído no puede tumbar la confirmación del pago.
    console.error("[notify] no se pudo enviar el correo:", error);
  }
}
