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
    comments: [
      {
        text: { type: String, trim: true, required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date },
        deleteStatus: { type: String, enum: ["pending", "approved", "rejected"] },
        deleteRequestedBy: { type: Schema.Types.ObjectId, ref: "User" },
        deleteRequestedAt: { type: Date },
        deleteReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
        deleteReviewedAt: { type: Date },
      },
    ],
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

function ensureCommentDeletePaths(schema: Schema) {
  const comments = schema.path("comments") as { schema?: Schema } | undefined;
  const sub = comments?.schema;
  if (!sub || sub.path("deleteStatus")) return;
  sub.add({
    deleteStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    deleteRequestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deleteRequestedAt: { type: Date },
    deleteReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deleteReviewedAt: { type: Date },
  });
}

relaxDescription(supportSchema);
ensureCommentDeletePaths(supportSchema);
if (mongoose.models.Support) {
  relaxDescription(mongoose.models.Support.schema);
  ensureCommentDeletePaths(mongoose.models.Support.schema);
}

export type SupportDoc = InferSchemaType<typeof supportSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Support: Model<SupportDoc> =
  (mongoose.models.Support as Model<SupportDoc>) ||
  mongoose.model<SupportDoc>("Support", supportSchema);
