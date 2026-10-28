import { Schema, model, Document } from "mongoose";

/** Un solo documento (key = "store") con lo que la tienda puede ajustar sin tocar código. */
export interface ISettings extends Document {
  key: "store";
  storeName: string;
  whatsapp: string;
  email: string;
  instagram: string;
  city: string;
  deliveryFeeCents: number;
  freeDeliveryFromCents: number | null;
  minOrderCents: number;
  deliveryNote: string;
  announcement: string;
  acceptingOrders: boolean;
}

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, default: "store", unique: true },
    storeName: { type: String, default: "YOKA Market" },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "" },
    instagram: { type: String, default: "https://www.instagram.com/yokamarket.ec/" },
    city: { type: String, default: "" },
    deliveryFeeCents: { type: Number, default: 0 },
    freeDeliveryFromCents: { type: Number, default: null },
    minOrderCents: { type: Number, default: 0 },
    deliveryNote: { type: String, default: "Pedidos a domicilio. Te confirmamos la hora de entrega por WhatsApp." },
    announcement: { type: String, default: "" },
    acceptingOrders: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Settings = model<ISettings>("Settings", settingsSchema);
