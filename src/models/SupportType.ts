import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const supportTypeSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type SupportTypeDoc = InferSchemaType<typeof supportTypeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SupportType: Model<SupportTypeDoc> =
  (mongoose.models.SupportType as Model<SupportTypeDoc>) ||
  mongoose.model<SupportTypeDoc>("SupportType", supportTypeSchema);
