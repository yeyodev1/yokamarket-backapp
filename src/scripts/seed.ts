import "dotenv/config";
import mongoose from "mongoose";
import { dbConnect } from "../config/mongo";
import { seedCatalogIfEmpty } from "../services/seed.service";
import { seedAdmin } from "../services/auth.service";

/** pnpm seed [--force]  → --force borra y recarga el catálogo del PDF. */
async function main() {
  await dbConnect();
  const force = process.argv.includes("--force");
  const loaded = await seedCatalogIfEmpty(force);
  console.log(loaded ? "Catálogo sembrado." : "El catálogo ya existía; no se tocó (usa --force para recargar).");
  await seedAdmin();
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
