import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const studentSchema = new Schema(
  {
    roll: { type: String, required: true, trim: true },
    serial: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    studentNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    guardianPhone: { type: String, required: true, trim: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    batch: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    extraFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

studentSchema.index({ name: "text", studentNumber: "text", roll: "text" });
studentSchema.index({ branch: 1, group: 1, batch: 1 });
studentSchema.index({ guardianPhone: 1 });
studentSchema.index({ roll: 1 });
studentSchema.index({ serial: 1 });

export type StudentDoc = InferSchemaType<typeof studentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Student: Model<StudentDoc> =
  (mongoose.models.Student as Model<StudentDoc>) ||
  mongoose.model<StudentDoc>("Student", studentSchema);
