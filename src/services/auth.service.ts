import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";
import { AuthUser } from "../types/AuthRequest";

const TOKEN_DAYS = 30;

function sign(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: `${TOKEN_DAYS}d` });
}

function toAuthUser(user: { _id: unknown; email: string; name: string }): AuthUser {
  return { id: String(user._id), email: user.email, name: user.name, role: "admin" };
}

/** Crea el admin de ADMIN_EMAIL/ADMIN_PASSWORD si todavía no existe ninguno. */
export async function seedAdmin(): Promise<void> {
  if (!env.ADMIN_PASSWORD) return;
  const exists = await User.exists({ email: env.ADMIN_EMAIL });
  if (exists) return;
  await User.create({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 10),
  });
  console.log(`Admin creado: ${env.ADMIN_EMAIL}`);
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new CustomError("Correo o contraseña incorrectos", 401);
  }
  const authUser = toAuthUser(user);
  return { token: sign(authUser), user: authUser };
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await User.findById(userId);
  if (!user) throw new CustomError("Usuario no encontrado", 404);
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    throw new CustomError("La contraseña actual no es correcta", 400);
  }
  if (next.length < 8) throw new CustomError("La nueva contraseña debe tener al menos 8 caracteres", 400);
  user.passwordHash = await bcrypt.hash(next, 10);
  await user.save();
}
