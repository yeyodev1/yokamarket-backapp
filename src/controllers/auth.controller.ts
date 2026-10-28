import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { AuthRequest } from "../types/AuthRequest";
import { str } from "../utils/validate";

export async function login(req: Request, res: Response) {
  const email = str(req.body?.email, "El correo", { max: 120 });
  const password = str(req.body?.password, "La contraseña", { max: 100 });
  res.json(await authService.login(email, password));
}

export async function me(req: AuthRequest, res: Response) {
  res.json(req.user);
}

export async function changePassword(req: AuthRequest, res: Response) {
  const current = str(req.body?.currentPassword, "La contraseña actual", { max: 100 });
  const next = str(req.body?.newPassword, "La nueva contraseña", { max: 100 });
  await authService.changePassword(req.user!.id, current, next);
  res.json({ ok: true });
}
