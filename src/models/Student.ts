import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const studentSchema = new Schema(
  {
    roll: { type: String, required: false, default: "", trim: true },
    serial: { type: String, required: false, default: "", trim: true },
    name: { type: String, required: false, default: "", trim: true },
    studentNumber: { type: String, required: false, default: "", trim: true, uppercase: true },
    guardianPhone: { type: String, required: false, default: "", trim: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: false },
    group: { type: Schema.Types.ObjectId, ref: "Group", required: false },
    batch: { type: Schema.Types.ObjectId, ref: "Batch", required: false },
    extraFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

studentSchema.index({ name: "text", studentNumber: "text", roll: "text" });
studentSchema.index(
  { roll: 1 },
  { unique: true, name: "roll_unique", partialFilterExpression: { roll: { $gt: "" } } }
);
studentSchema.index({ branch: 1, group: 1, batch: 1 });
studentSchema.index({ guardianPhone: 1 });
studentSchema.index({ serial: 1 });

function relaxOptionalFields(schema: Schema) {
  for (const key of ["roll", "serial", "name", "studentNumber", "guardianPhone", "branch", "group", "batch"]) {
    const path = schema.path(key);
    if (!path) continue;
    path.required(false);
    path.options.required = false;
    path.validators = path.validators.filter((validator) => validator.type !== "required");
  }
}

relaxOptionalFields(studentSchema);
if (mongoose.models.Student) {
  relaxOptionalFields(mongoose.models.Student.schema);
}

export type StudentDoc = InferSchemaType<typeof studentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Student: Model<StudentDoc> =
  (mongoose.models.Student as Model<StudentDoc>) ||
  mongoose.model<StudentDoc>("Student", studentSchema);
