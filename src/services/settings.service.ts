import { Settings, ISettings } from "../models/settings.model";
import { CustomError } from "../errors/customError.error";
import { int, str } from "../utils/validate";

export async function getSettings(): Promise<ISettings> {
  const found = await Settings.findOne({ key: "store" });
  if (found) return found;
  return Settings.create({ key: "store" });
}

export function publicSettings(s: ISettings) {
  return {
    storeName: s.storeName,
    whatsapp: s.whatsapp,
    email: s.email,
    instagram: s.instagram,
    city: s.city,
    deliveryFeeCents: s.deliveryFeeCents,
    freeDeliveryFromCents: s.freeDeliveryFromCents,
    minOrderCents: s.minOrderCents,
    deliveryNote: s.deliveryNote,
    announcement: s.announcement,
    acceptingOrders: s.acceptingOrders,
  };
}

export async function updateSettings(body: Record<string, unknown>): Promise<ISettings> {
  const s = await getSettings();
  if (body.storeName !== undefined) s.storeName = str(body.storeName, "El nombre", { max: 80 });
  if (body.whatsapp !== undefined) s.whatsapp = str(body.whatsapp, "WhatsApp", { required: false, max: 20 });
  if (body.email !== undefined) s.email = str(body.email, "El correo", { required: false, max: 120 });
  if (body.instagram !== undefined) s.instagram = str(body.instagram, "Instagram", { required: false, max: 200 });
  if (body.city !== undefined) s.city = str(body.city, "La ciudad", { required: false, max: 80 });
  if (body.deliveryFeeCents !== undefined) s.deliveryFeeCents = int(body.deliveryFeeCents, "El costo de envío", { min: 0 });
  if (body.freeDeliveryFromCents !== undefined) {
    s.freeDeliveryFromCents =
      body.freeDeliveryFromCents === null || body.freeDeliveryFromCents === ""
        ? null
        : int(body.freeDeliveryFromCents, "El mínimo para envío gratis", { min: 0 });
  }
  if (body.minOrderCents !== undefined) s.minOrderCents = int(body.minOrderCents, "El pedido mínimo", { min: 0 });
  if (body.deliveryNote !== undefined) s.deliveryNote = str(body.deliveryNote, "La nota de entrega", { required: false, max: 300 });
  if (body.announcement !== undefined) s.announcement = str(body.announcement, "El anuncio", { required: false, max: 200 });
  if (body.acceptingOrders !== undefined) {
    if (typeof body.acceptingOrders !== "boolean") throw new CustomError("acceptingOrders debe ser booleano", 400);
    s.acceptingOrders = body.acceptingOrders;
  }
  await s.save();
  return s;
}
