import { Schema, model, Document, Types } from "mongoose";

export interface IProduct extends Document {
  name: string;
  slug: string;
  category: Types.ObjectId;
  priceCents: number;
  unit: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  badges: string[];
  kcal: number | null;
  portion: string;
  image: string;
  images: string[];
  featured: boolean;
  active: boolean;
  sortOrder: number;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    // En centavos: $8,75 → 875.
    priceCents: { type: Number, required: true, min: 0 },
    // "Pack de 4 unidades", "Frasco de 300 ml".
    unit: { type: String, default: "", trim: true },
    shortDescription: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    ingredients: { type: String, default: "", trim: true },
    // "Sin azúcares añadidos", "Sin gluten", "Sin aceites añadidos".
    badges: { type: [String], default: [] },
    kcal: { type: Number, default: null },
    portion: { type: String, default: "", trim: true },
    image: { type: String, default: "", trim: true },
    images: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Product = model<IProduct>("Product", productSchema);
