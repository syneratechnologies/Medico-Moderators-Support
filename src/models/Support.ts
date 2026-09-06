import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const supportSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    supportType: { type: Schema.Types.ObjectId, ref: "SupportType", required: true },
    description: { type: String, trim: true, default: "", required: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedModerator: { type: Schema.Types.ObjectId, ref: "User" },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    dueDate: { type: Date },
    outcome: { type: String, trim: true },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

supportSchema.index({ assignedModerator: 1, status: 1 });
supportSchema.index({ createdAt: -1 });
supportSchema.index({ student: 1, createdAt: -1 });

function relaxDescription(schema: Schema) {
  const path = schema.path("description");
  if (!path) return;
  path.required(false);
  path.options.required = false;
  path.validators = path.validators.filter((validator) => validator.type !== "required");
}

relaxDescription(supportSchema);
if (mongoose.models.Support) {
  relaxDescription(mongoose.models.Support.schema);
}

export type SupportDoc = InferSchemaType<typeof supportSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Support: Model<SupportDoc> =
  (mongoose.models.Support as Model<SupportDoc>) ||
  mongoose.model<SupportDoc>("Support", supportSchema);
