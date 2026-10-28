import { Category, ICategory } from "../models/category.model";
import { Product, IProduct } from "../models/product.model";
import { CustomError } from "../errors/customError.error";
import { slugify } from "../utils/slugify";
import { int, num, str } from "../utils/validate";

export function publicProduct(p: IProduct) {
  const category: any = p.category;
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    category: category?.slug ? { slug: category.slug, name: category.name } : String(category),
    priceCents: p.priceCents,
    unit: p.unit,
    shortDescription: p.shortDescription,
    description: p.description,
    ingredients: p.ingredients,
    badges: p.badges,
    kcal: p.kcal,
    portion: p.portion,
    image: p.image,
    images: p.images,
    featured: p.featured,
    active: p.active,
    sortOrder: p.sortOrder,
  };
}

export function publicCategory(c: ICategory) {
  return {
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    tagline: c.tagline,
    description: c.description,
    note: c.note,
    sortOrder: c.sortOrder,
    active: c.active,
  };
}

/** Catálogo público: categorías activas con sus productos activos, en orden. */
export async function getCatalog() {
  const [categories, products] = await Promise.all([
    Category.find({ active: true }).sort({ sortOrder: 1, name: 1 }),
    Product.find({ active: true }).populate("category", "slug name").sort({ sortOrder: 1, name: 1 }),
  ]);
  return {
    categories: categories.map(publicCategory),
    products: products.map(publicProduct),
  };
}

export async function getProductBySlug(slug: string) {
  const product = await Product.findOne({ slug, active: true }).populate("category", "slug name");
  if (!product) throw new CustomError("Producto no encontrado", 404);
  return publicProduct(product);
}

// ---- Admin ----

export async function listAllProducts() {
  const products = await Product.find().populate("category", "slug name").sort({ sortOrder: 1, name: 1 });
  return products.map(publicProduct);
}

export async function listAllCategories() {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
  return categories.map(publicCategory);
}

async function resolveCategory(value: unknown) {
  const key = str(value, "La categoría", { max: 80 });
  const category = await Category.findOne({ $or: [{ slug: key }, { _id: key.match(/^[a-f\d]{24}$/i) ? key : undefined }] });
  if (!category) throw new CustomError("La categoría no existe", 400);
  return category;
}

function parseProductBody(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<IProduct> = {};
  const has = (k: string) => body[k] !== undefined;

  if (!partial || has("name")) out.name = str(body.name, "El nombre", { max: 120 });
  if (has("slug")) out.slug = slugify(str(body.slug, "El slug", { max: 120 }));
  if (!partial || has("priceCents")) out.priceCents = int(body.priceCents, "El precio", { min: 0 });
  if (has("unit")) out.unit = str(body.unit, "La presentación", { required: false, max: 120 });
  if (has("shortDescription")) out.shortDescription = str(body.shortDescription, "La descripción corta", { required: false, max: 200 });
  if (has("description")) out.description = str(body.description, "La descripción", { required: false, max: 2000 });
  if (has("ingredients")) out.ingredients = str(body.ingredients, "Los ingredientes", { required: false, max: 500 });
  if (has("portion")) out.portion = str(body.portion, "La porción", { required: false, max: 60 });
  if (has("image")) out.image = str(body.image, "La imagen", { required: false, max: 600 });
  if (has("images")) {
    if (!Array.isArray(body.images)) throw new CustomError("images debe ser una lista", 400);
    out.images = body.images.map((i) => str(i, "La imagen", { max: 600 }));
  }
  if (has("badges")) {
    if (!Array.isArray(body.badges)) throw new CustomError("badges debe ser una lista", 400);
    out.badges = body.badges.map((b) => str(b, "La etiqueta", { max: 60 }));
  }
  if (has("kcal")) out.kcal = body.kcal === null || body.kcal === "" ? null : num(body.kcal, "Las calorías", { min: 0 });
  if (has("featured")) out.featured = Boolean(body.featured);
  if (has("active")) out.active = Boolean(body.active);
  if (has("sortOrder")) out.sortOrder = int(body.sortOrder, "El orden");
  return out;
}

export async function createProduct(body: Record<string, unknown>) {
  const data = parseProductBody(body, false);
  const category = await resolveCategory(body.category);
  const slug = data.slug || slugify(data.name!);
  const product = await Product.create({ ...data, slug, category: category._id });
  await product.populate("category", "slug name");
  return publicProduct(product);
}

export async function updateProduct(id: string, body: Record<string, unknown>) {
  const product = await Product.findById(id);
  if (!product) throw new CustomError("Producto no encontrado", 404);
  const data = parseProductBody(body, true);
  Object.assign(product, data);
  if (body.category !== undefined) product.category = (await resolveCategory(body.category))._id as any;
  await product.save();
  await product.populate("category", "slug name");
  return publicProduct(product);
}

export async function deleteProduct(id: string) {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new CustomError("Producto no encontrado", 404);
}

function parseCategoryBody(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<ICategory> = {};
  const has = (k: string) => body[k] !== undefined;
  if (!partial || has("name")) out.name = str(body.name, "El nombre", { max: 80 });
  if (has("slug")) out.slug = slugify(str(body.slug, "El slug", { max: 80 }));
  if (has("tagline")) out.tagline = str(body.tagline, "El tagline", { required: false, max: 200 });
  if (has("description")) out.description = str(body.description, "La descripción", { required: false, max: 1000 });
  if (has("note")) out.note = str(body.note, "La nota", { required: false, max: 300 });
  if (has("sortOrder")) out.sortOrder = int(body.sortOrder, "El orden");
  if (has("active")) out.active = Boolean(body.active);
  return out;
}

export async function createCategory(body: Record<string, unknown>) {
  const data = parseCategoryBody(body, false);
  const category = await Category.create({ ...data, slug: data.slug || slugify(data.name!) });
  return publicCategory(category);
}

export async function updateCategory(id: string, body: Record<string, unknown>) {
  const category = await Category.findById(id);
  if (!category) throw new CustomError("Categoría no encontrada", 404);
  Object.assign(category, parseCategoryBody(body, true));
  await category.save();
  return publicCategory(category);
}

export async function deleteCategory(id: string) {
  const count = await Product.countDocuments({ category: id });
  if (count > 0) throw new CustomError("La categoría tiene productos; muévelos antes de borrarla", 409);
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new CustomError("Categoría no encontrada", 404);
}
