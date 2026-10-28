import { Schema, model, Document, Types } from "mongoose";

export const ORDER_STATUSES = [
  "pending", // creado, esperando el pago en Payphone
  "paid", // Payphone confirmó el cobro
  "preparing", // la tienda lo está armando
  "delivered", // entregado
  "failed", // Payphone lo rechazó
  "cancelled", // el cliente canceló o la tienda lo anuló
  "review", // pagado pero el monto no cuadra: revisar a mano
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  unit: string;
  priceCents: number;
  qty: number;
  subtotalCents: number;
}

export interface IPaymentAttempt {
  clientTransactionId: string;
  paymentId: number | null;
  payWithCard: string;
  payWithPayPhone: string;
  createdAt: Date;
}

export interface IOrder extends Document {
  code: string;
  clientTransactionId: string;
  attempts: IPaymentAttempt[];
  items: IOrderItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  customer: { name: string; phone: string; email: string; documentId: string };
  delivery: { address: string; city: string; sector: string; reference: string; notes: string };
  status: OrderStatus;
  payment: {
    provider: "payphone";
    paymentId: number | null;
    transactionId: number | null;
    authorizationCode: string;
    statusCode: number | null;
    transactionStatus: string;
    message: string;
    cardBrand: string;
    lastDigits: string;
    amountCents: number | null;
    email: string;
    phoneNumber: string;
    confirmedAt: Date | null;
    raw: unknown;
  };
  paidAt: Date | null;
  internalNotes: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    unit: { type: String, default: "" },
    priceCents: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    subtotalCents: { type: Number, required: true },
  },
  { _id: false }
);

const attemptSchema = new Schema<IPaymentAttempt>(
  {
    clientTransactionId: { type: String, required: true },
    paymentId: { type: Number, default: null },
    payWithCard: { type: String, default: "" },
    payWithPayPhone: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    code: { type: String, required: true, unique: true },
    // El último clientTransactionId enviado a Payphone (índice para el Confirm).
    clientTransactionId: { type: String, required: true, unique: true },
    attempts: { type: [attemptSchema], default: [] },
    items: { type: [orderItemSchema], required: true },
    subtotalCents: { type: Number, required: true },
    deliveryFeeCents: { type: Number, default: 0 },
    totalCents: { type: Number, required: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: "" },
      documentId: { type: String, default: "" },
    },
    delivery: {
      address: { type: String, required: true },
      city: { type: String, default: "" },
      sector: { type: String, default: "" },
      reference: { type: String, default: "" },
      notes: { type: String, default: "" },
    },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    payment: {
      provider: { type: String, default: "payphone" },
      paymentId: { type: Number, default: null },
      transactionId: { type: Number, default: null },
      authorizationCode: { type: String, default: "" },
      statusCode: { type: Number, default: null },
      transactionStatus: { type: String, default: "" },
      message: { type: String, default: "" },
      cardBrand: { type: String, default: "" },
      lastDigits: { type: String, default: "" },
      amountCents: { type: Number, default: null },
      email: { type: String, default: "" },
      phoneNumber: { type: String, default: "" },
      confirmedAt: { type: Date, default: null },
      raw: { type: Schema.Types.Mixed, default: null },
    },
    paidAt: { type: Date, default: null },
    internalNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ "attempts.clientTransactionId": 1 });

export const Order = model<IOrder>("Order", orderSchema);
