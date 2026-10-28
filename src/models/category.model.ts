import { Schema, model, Document } from "mongoose";

export interface ICategory extends Document {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  note: string;
  sortOrder: number;
  active: boolean;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    tagline: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    // Texto al pie de la línea ("Presentación en envase kraft...").
    note: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Category = model<ICategory>("Category", categorySchema);
