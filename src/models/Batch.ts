import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const batchSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type BatchDoc = InferSchemaType<typeof batchSchema> & { _id: mongoose.Types.ObjectId };

export const Batch: Model<BatchDoc> =
  (mongoose.models.Batch as Model<BatchDoc>) || mongoose.model<BatchDoc>("Batch", batchSchema);
