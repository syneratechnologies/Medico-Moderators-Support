import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const groupSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type GroupDoc = InferSchemaType<typeof groupSchema> & { _id: mongoose.Types.ObjectId };

export const Group: Model<GroupDoc> =
  (mongoose.models.Group as Model<GroupDoc>) || mongoose.model<GroupDoc>("Group", groupSchema);
