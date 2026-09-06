import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const importRowSchema = new Schema(
  {
    rowNumber: Number,
    roll: String,
    serial: String,
    name: String,
    studentNumber: String,
    guardianPhone: String,
    branch: String,
    group: String,
    batch: String,
    supportType: String,
    description: String,
    isExistingStudent: Boolean,
    errors: [String],
  },
  { _id: false }
);

const importJobSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["preview", "confirmed", "expired"], default: "preview" },
    fileName: String,
    mapping: { type: Schema.Types.Mixed },
    supportTypeName: String,
    description: String,
    rows: [importRowSchema],
    summary: {
      total: Number,
      valid: Number,
      invalid: Number,
      newStudents: Number,
      existingStudents: Number,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

importJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ImportJobDoc = InferSchemaType<typeof importJobSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ImportJob: Model<ImportJobDoc> =
  (mongoose.models.ImportJob as Model<ImportJobDoc>) ||
  mongoose.model<ImportJobDoc>("ImportJob", importJobSchema);
