// Debe ser el primer import: carga las variables de entorno antes de que
// cualquier otro módulo lea process.env al importarse.
import "dotenv/config";
import { dbConnect } from "./config/mongo";
import { createApp } from "./app";
import { seedAdmin } from "./services/auth.service";
import { seedCatalogIfEmpty } from "./services/seed.service";
import { env } from "./config/env";

async function main() {
  await dbConnect();
  await seedCatalogIfEmpty();
  await seedAdmin();

  const { server } = createApp();
  server.listen(env.PORT, () => {
    console.log(`YOKA Market API en http://localhost:${env.PORT}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
