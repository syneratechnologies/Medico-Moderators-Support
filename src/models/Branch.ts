import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const branchSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type BranchDoc = InferSchemaType<typeof branchSchema> & { _id: mongoose.Types.ObjectId };

export const Branch: Model<BranchDoc> =
  (mongoose.models.Branch as Model<BranchDoc>) ||
  mongoose.model<BranchDoc>("Branch", branchSchema);
