import { Types } from "mongoose";
import { Order, IOrder, ORDER_STATUSES, OrderStatus } from "../models/order.model";
import { Product } from "../models/product.model";
import { CustomError } from "../errors/customError.error";
import { clientTransactionId as newTxId, orderCode } from "../utils/code";
import { email as validateEmail, int, phoneEc, str } from "../utils/validate";
import { getSettings } from "./settings.service";
import * as payphone from "./payphone.service";
import { env } from "../config/env";
import { notifyPaidOrder } from "./notify.service";

export interface CreateOrderInput {
  items: Array<{ productId: string; qty: number }>;
  customer: { name: string; phone: string; email?: string; documentId?: string };
  delivery: { address: string; city?: string; sector?: string; reference?: string; notes?: string };
}

/** Lo que ve el cliente: nunca el raw de Payphone ni las notas internas. */
export function publicOrder(order: IOrder) {
  const attempt = order.attempts[order.attempts.length - 1];
  return {
    code: order.code,
    status: order.status,
    items: order.items.map((i) => ({
      name: i.name,
      unit: i.unit,
      priceCents: i.priceCents,
      qty: i.qty,
      subtotalCents: i.subtotalCents,
    })),
    subtotalCents: order.subtotalCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    customer: { name: order.customer.name, phone: order.customer.phone, email: order.customer.email },
    delivery: order.delivery,
    payment: {
      authorizationCode: order.payment.authorizationCode,
      cardBrand: order.payment.cardBrand,
      lastDigits: order.payment.lastDigits,
      message: order.payment.message,
      confirmedAt: order.payment.confirmedAt,
    },
    payUrl: order.status === "pending" ? attempt?.payWithCard || "" : "",
    // Datos para la Cajita de pagos (el token va en el front, atado al dominio).
    checkout:
      order.status === "pending" && env.PAYPHONE_MODE === "box"
        ? {
            clientTransactionId: order.clientTransactionId,
            ...payphone.splitAmount(order.totalCents),
            storeId: env.PAYPHONE_STORE_ID,
            reference: `Pedido ${order.code} YOKA Market`,
            email: order.customer.email,
            phoneNumber: order.customer.phone,
            documentId: order.customer.documentId,
          }
        : null,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
  };
}

function parseInput(body: any): CreateOrderInput {
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    throw new CustomError("El carrito está vacío", 400);
  }
  if (body.items.length > 50) throw new CustomError("Demasiados productos en el carrito", 400);

  const items = body.items.map((i: any) => {
    const productId = str(i?.productId, "El producto", { max: 40 });
    if (!Types.ObjectId.isValid(productId)) throw new CustomError("Producto inválido", 400);
    return { productId, qty: int(i?.qty, "La cantidad", { min: 1, max: 99 }) };
  });

  const c = body.customer || {};
  const d = body.delivery || {};
  return {
    items,
    customer: {
      name: str(c.name, "Tu nombre", { min: 2, max: 80 }),
      phone: phoneEc(c.phone),
      email: validateEmail(c.email, false),
      documentId: str(c.documentId, "La cédula", { required: false, max: 20 }),
    },
    delivery: {
      address: str(d.address, "La dirección", { min: 5, max: 300 }),
      city: str(d.city, "La ciudad", { required: false, max: 80 }),
      sector: str(d.sector, "El sector", { required: false, max: 120 }),
      reference: str(d.reference, "La referencia", { required: false, max: 300 }),
      notes: str(d.notes, "Las notas", { required: false, max: 500 }),
    },
  };
}

/** Crea el pedido con precios del servidor y abre el pago en Payphone. */
export async function createOrder(body: unknown) {
  const input = parseInput(body);
  const settings = await getSettings();
  if (!settings.acceptingOrders) {
    throw new CustomError("Por ahora no estamos recibiendo pedidos. Vuelve pronto.", 409);
  }

  // Cantidades por producto (el carrito podría repetir ids).
  const qtyById = new Map<string, number>();
  for (const i of input.items) qtyById.set(i.productId, (qtyById.get(i.productId) || 0) + i.qty);

  const products = await Product.find({ _id: { $in: [...qtyById.keys()] }, active: true });
  if (products.length !== qtyById.size) {
    throw new CustomError("Alguno de los productos ya no está disponible. Revisa tu carrito.", 409);
  }

  const items = products.map((p) => {
    const qty = qtyById.get(String(p._id))!;
    return {
      product: p._id,
      name: p.name,
      unit: p.unit,
      priceCents: p.priceCents,
      qty,
      subtotalCents: p.priceCents * qty,
    };
  });

  const subtotalCents = items.reduce((s, i) => s + i.subtotalCents, 0);
  if (settings.minOrderCents && subtotalCents < settings.minOrderCents) {
    throw new CustomError(`El pedido mínimo es $${(settings.minOrderCents / 100).toFixed(2)}`, 400);
  }
  const freeDelivery = settings.freeDeliveryFromCents != null && subtotalCents >= settings.freeDeliveryFromCents;
  const deliveryFeeCents = freeDelivery ? 0 : settings.deliveryFeeCents;
  const totalCents = subtotalCents + deliveryFeeCents;
  if (totalCents <= 0) throw new CustomError("El total del pedido no es válido", 400);

  const txId = newTxId();
  const order = await Order.create({
    code: orderCode(),
    clientTransactionId: txId,
    items,
    subtotalCents,
    deliveryFeeCents,
    totalCents,
    customer: input.customer,
    delivery: input.delivery,
    status: "pending",
  });

  await openPayment(order);
  return publicOrder(order);
}

/**
 * Abre el intento de pago. Con la cajita solo se registra el clientTransactionId
 * (el cobro ocurre en el navegador); con redirección se llama a Prepare.
 */
async function openPayment(order: IOrder) {
  const txId = order.clientTransactionId;
  if (env.PAYPHONE_MODE === "box") {
    order.attempts.push({ clientTransactionId: txId, paymentId: null, payWithCard: "", payWithPayPhone: "", createdAt: new Date() });
    await order.save();
    return;
  }
  const prepared = await payphone.prepare({
    totalCents: order.totalCents,
    clientTransactionId: txId,
    reference: `Pedido ${order.code} YOKA Market`,
    email: order.customer.email || undefined,
    phoneNumber: order.customer.phone || undefined,
    documentId: order.customer.documentId || undefined,
    lineItems: order.items.map((i) => ({
      productName: i.name,
      unitPrice: i.priceCents,
      quantity: i.qty,
      totalAmount: i.subtotalCents,
    })),
  });

  order.attempts.push({
    clientTransactionId: txId,
    paymentId: Number.isFinite(Number(prepared.paymentId)) ? Number(prepared.paymentId) : null,
    payWithCard: prepared.payWithCard,
    payWithPayPhone: prepared.payWithPayPhone,
    createdAt: new Date(),
  });
  order.payment.raw = { prepared };
  await order.save();
}

export async function getOrderByCode(code: string) {
  const order = await Order.findOne({ code: code.toUpperCase().trim() });
  if (!order) throw new CustomError("Pedido no encontrado", 404);
  return publicOrder(order);
}

/**
 * El cliente volvió sin pagar (o el enlace venció: Payphone los cierra a los
 * 10 minutos). Se abre un intento nuevo con otro clientTransactionId.
 */
export async function retryPayment(code: string) {
  const order = await Order.findOne({ code: code.toUpperCase().trim() });
  if (!order) throw new CustomError("Pedido no encontrado", 404);
  if (order.status === "paid" || order.status === "preparing" || order.status === "delivered") {
    throw new CustomError("Este pedido ya está pagado", 409);
  }
  if (order.status === "review") throw new CustomError("Este pedido está en revisión; escríbenos por WhatsApp", 409);

  order.clientTransactionId = newTxId();
  order.status = "pending";
  await openPayment(order);
  return publicOrder(order);
}

/**
 * Confirmación del pago. Idempotente: Payphone puede redirigir dos veces y el
 * cliente puede recargar /pay-response; la segunda vez solo devolvemos el estado.
 */
export async function confirmPayment(body: any) {
  const id = int(body?.id, "El id de la transacción", { min: 1 });
  const txId = str(body?.clientTransactionId, "El identificador de la transacción", { max: 60 });

  const order = await Order.findOne({
    $or: [{ clientTransactionId: txId }, { "attempts.clientTransactionId": txId }],
  });
  if (!order) throw new CustomError("Pedido no encontrado", 404);

  if (["paid", "preparing", "delivered"].includes(order.status)) return publicOrder(order);

  const result = await payphone.confirm(id, txId);

  order.payment.transactionId = result.transactionId;
  order.payment.authorizationCode = result.authorizationCode;
  order.payment.statusCode = result.statusCode;
  order.payment.transactionStatus = result.transactionStatus;
  order.payment.message = result.message;
  order.payment.cardBrand = result.cardBrand;
  order.payment.lastDigits = result.lastDigits;
  order.payment.amountCents = result.amount;
  order.payment.email = result.email;
  order.payment.phoneNumber = result.phoneNumber;
  order.payment.confirmedAt = new Date();
  order.payment.raw = { ...(order.payment.raw as object), confirm: result.raw };

  if (payphone.isApproved(result)) {
    const sameTx = !result.clientTransactionId || result.clientTransactionId === txId;
    if (result.amount === order.totalCents && sameTx) {
      order.status = "paid";
      order.paidAt = new Date();
    } else {
      // Cobró pero no cuadra: no se despacha solo, lo revisa una persona.
      order.status = "review";
      order.internalNotes = `Monto confirmado ${result.amount} vs pedido ${order.totalCents} (tx ${result.clientTransactionId}).`;
    }
  } else {
    order.status = "failed";
  }

  await order.save();
  if (order.status === "paid") await notifyPaidOrder(order);
  return publicOrder(order);
}

/** El cliente cerró la ventana de Payphone con la X. */
export async function cancelPayment(body: any) {
  const txId = str(body?.clientTransactionId, "El identificador de la transacción", { max: 60 });
  const order = await Order.findOne({ clientTransactionId: txId });
  if (!order) throw new CustomError("Pedido no encontrado", 404);
  if (order.status === "pending") {
    order.status = "cancelled";
    await order.save();
  }
  return publicOrder(order);
}

// ---- Admin ----

export async function listOrders(query: any) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const filter: Record<string, unknown> = {};
  if (query.status && ORDER_STATUSES.includes(query.status)) filter.status = query.status;
  if (query.q) {
    const rx = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ code: rx }, { "customer.name": rx }, { "customer.phone": rx }];
  }
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  return { items: items.map(adminOrder), total, page, pages: Math.ceil(total / limit) };
}

export function adminOrder(order: IOrder) {
  return {
    ...publicOrder(order),
    id: String(order._id),
    clientTransactionId: order.clientTransactionId,
    customer: order.customer,
    payment: {
      paymentId: order.attempts[order.attempts.length - 1]?.paymentId ?? null,
      transactionId: order.payment.transactionId,
      authorizationCode: order.payment.authorizationCode,
      statusCode: order.payment.statusCode,
      transactionStatus: order.payment.transactionStatus,
      message: order.payment.message,
      cardBrand: order.payment.cardBrand,
      lastDigits: order.payment.lastDigits,
      amountCents: order.payment.amountCents,
      confirmedAt: order.payment.confirmedAt,
    },
    attempts: order.attempts.length,
    internalNotes: order.internalNotes,
    updatedAt: order.updatedAt,
  };
}

export async function getOrderAdmin(id: string) {
  const order = await Order.findById(id);
  if (!order) throw new CustomError("Pedido no encontrado", 404);
  return adminOrder(order);
}

const ADMIN_TRANSITIONS: Record<string, OrderStatus[]> = {
  paid: ["preparing", "delivered", "cancelled"],
  review: ["paid", "preparing", "cancelled"],
  preparing: ["delivered", "cancelled", "paid"],
  delivered: ["preparing"],
  pending: ["cancelled"],
  failed: ["cancelled"],
  cancelled: [],
};

export async function updateOrderStatus(id: string, body: any) {
  const order = await Order.findById(id);
  if (!order) throw new CustomError("Pedido no encontrado", 404);
  const next = str(body?.status, "El estado", { max: 20 }) as OrderStatus;
  if (!ORDER_STATUSES.includes(next)) throw new CustomError("Estado inválido", 400);
  if (!ADMIN_TRANSITIONS[order.status]?.includes(next)) {
    throw new CustomError(`No se puede pasar de ${order.status} a ${next}`, 409);
  }
  order.status = next;
  if (next === "paid" && !order.paidAt) order.paidAt = new Date();
  if (body.internalNotes !== undefined) {
    order.internalNotes = str(body.internalNotes, "Las notas", { required: false, max: 1000 });
  }
  await order.save();
  return adminOrder(order);
}

export async function updateOrderNotes(id: string, body: any) {
  const order = await Order.findById(id);
  if (!order) throw new CustomError("Pedido no encontrado", 404);
  order.internalNotes = str(body?.internalNotes, "Las notas", { required: false, max: 1000 });
  await order.save();
  return adminOrder(order);
}

/** Resumen para el panel: hoy, mes, pendientes, ventas de los últimos 14 días y últimos pedidos. */
export async function stats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  const start14 = new Date(startOfDay);
  start14.setDate(start14.getDate() - 13);
  const paidStatuses = ["paid", "preparing", "delivered"];

  const [today, month, toPrepare, inReview, byDay, recent] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $in: paidStatuses }, paidAt: { $gte: startOfDay } } },
      { $group: { _id: null, count: { $sum: 1 }, totalCents: { $sum: "$totalCents" } } },
    ]),
    Order.aggregate([
      { $match: { status: { $in: paidStatuses }, paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, count: { $sum: 1 }, totalCents: { $sum: "$totalCents" } } },
    ]),
    Order.countDocuments({ status: { $in: ["paid", "preparing"] } }),
    Order.countDocuments({ status: "review" }),
    Order.aggregate([
      { $match: { status: { $in: paidStatuses }, paidAt: { $gte: start14 } } },
      {
        $group: {
          // Día en hora de Ecuador, para que "hoy" coincida con lo que ve la tienda.
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt", timezone: "America/Guayaquil" } },
          count: { $sum: 1 },
          totalCents: { $sum: "$totalCents" },
        },
      },
    ]),
    Order.find({ status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).limit(6),
  ]);

  const dayMap = new Map<string, { count: number; totalCents: number }>(
    byDay.map((d: any) => [d._id, { count: d.count, totalCents: d.totalCents }])
  );
  const days: Array<{ date: string; count: number; totalCents: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startOfDay);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
    days.push({ date: key, ...(dayMap.get(key) || { count: 0, totalCents: 0 }) });
  }

  // Productos más vendidos del mes.
  const topProducts = await Order.aggregate([
    { $match: { status: { $in: paidStatuses }, paidAt: { $gte: startOfMonth } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.name", qty: { $sum: "$items.qty" }, totalCents: { $sum: "$items.subtotalCents" } } },
    { $sort: { qty: -1 } },
    { $limit: 5 },
  ]);

  return {
    today: { count: today[0]?.count || 0, totalCents: today[0]?.totalCents || 0 },
    month: { count: month[0]?.count || 0, totalCents: month[0]?.totalCents || 0 },
    toPrepare,
    inReview,
    days,
    topProducts: topProducts.map((t: any) => ({ name: t._id, qty: t.qty, totalCents: t.totalCents })),
    recent: recent.map(adminOrder),
  };
}
