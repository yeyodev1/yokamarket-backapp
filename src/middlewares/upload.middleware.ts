import multer from "multer";

/** Fotos en memoria (van directo a Cloudinary); tope 10 MB, que es lo que pesa una foto de celular. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
