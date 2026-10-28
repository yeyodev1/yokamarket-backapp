import { Request, Response } from "express";
import * as uploadService from "../services/upload.service";
import { CustomError } from "../errors/customError.error";

export async function uploadImage(req: Request, res: Response) {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new CustomError("No llegó ninguna foto", 400);
  res.status(201).json(await uploadService.uploadImage(file.buffer, file.mimetype));
}

export function status(_req: Request, res: Response) {
  res.json({ enabled: uploadService.isUploadEnabled() });
}
