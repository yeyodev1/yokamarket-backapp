import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthRequest, AuthUser } from "../types/AuthRequest";
import { CustomError } from "../errors/customError.error";

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new CustomError("Sesión requerida", 401);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = { id: payload.id, email: payload.email, name: payload.name, role: "admin" };
    next();
  } catch {
    throw new CustomError("Sesión inválida o caducada", 401);
  }
}
