import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";

let configured = false;

function ensureConfigured() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new CustomError("La subida de fotos no está configurada (Cloudinary)", 503);
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
}

export function isUploadEnabled(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/** Sube una imagen del panel a Cloudinary y devuelve una URL optimizada (f_auto, q_auto). */
export async function uploadImage(buffer: Buffer, mimetype: string): Promise<{ url: string; publicId: string }> {
  ensureConfigured();
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(mimetype)) {
    throw new CustomError("Solo se aceptan fotos JPG, PNG o WebP", 400);
  }
  const dataUri = `data:${mimetype};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "yokamarket/productos",
    resource_type: "image",
    // Se guarda a lo sumo en 1600px: suficiente para la web y más liviano.
    transformation: [{ width: 1600, height: 1600, crop: "limit" }],
  });
  const url = cloudinary.url(result.public_id, { secure: true, fetch_format: "auto", quality: "auto", width: 1400, crop: "limit" });
  return { url, publicId: result.public_id };
}
