import { Category } from "../models/category.model";
import { Product } from "../models/product.model";
import { categoriesSeed, productsSeed } from "../data/catalog";

/**
 * Carga el catálogo del PDF si la base está vacía. Es idempotente: si ya hay
 * categorías no toca nada, así el panel puede editar precios sin que un
 * redeploy los pise.
 */
export async function seedCatalogIfEmpty(force = false): Promise<boolean> {
  const count = await Category.countDocuments();
  if (count > 0 && !force) return false;

  if (force) {
    await Promise.all([Category.deleteMany({}), Product.deleteMany({})]);
  }

  const categories = await Category.insertMany(categoriesSeed);
  const bySlug = new Map(categories.map((c) => [c.slug, c._id]));

  await Product.insertMany(
    productsSeed.map(({ category, ...p }) => ({ ...p, category: bySlug.get(category) }))
  );
  console.log(`Catálogo cargado: ${categories.length} líneas, ${productsSeed.length} productos`);
  return true;
}
