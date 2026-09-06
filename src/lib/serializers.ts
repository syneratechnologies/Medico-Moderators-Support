function idOf(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

function nameOf(value: unknown) {
  if (typeof value === "object" && value !== null && "name" in value) {
    return String((value as { name: unknown }).name);
  }
  return "";
}

export function serializeStudent(student: Record<string, unknown>) {
  return {
    id: idOf(student._id ?? student.id),
    roll: student.roll,
    serial: student.serial,
    name: student.name,
    studentNumber: student.studentNumber,
    guardianPhone: student.guardianPhone,
    branch: { id: idOf(student.branch), name: nameOf(student.branch) },
    group: { id: idOf(student.group), name: nameOf(student.group) },
    batch: { id: idOf(student.batch), name: nameOf(student.batch) },
    extraFields: student.extraFields ?? {},
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

export function serializeSupport(support: Record<string, unknown>) {
  const student = support.student as Record<string, unknown> | undefined;
  return {
    id: idOf(support._id ?? support.id),
    student: student && typeof student === "object" && student.name
      ? serializeStudent(student)
      : { id: idOf(support.student) },
    supportType: {
      id: idOf(support.supportType),
      name: nameOf(support.supportType),
    },
    description: support.description,
    createdBy: {
      id: idOf(support.createdBy),
      name: nameOf(support.createdBy),
    },
    assignedModerator: support.assignedModerator
      ? {
          id: idOf(support.assignedModerator),
          name: nameOf(support.assignedModerator),
        }
      : null,
    assignedBy: support.assignedBy
      ? { id: idOf(support.assignedBy), name: nameOf(support.assignedBy) }
      : null,
    assignedAt: support.assignedAt ?? null,
    status: support.status,
    priority: support.priority,
    dueDate: support.dueDate ?? null,
    outcome: support.outcome ?? "",
    completedAt: support.completedAt ?? null,
    completedBy: support.completedBy
      ? { id: idOf(support.completedBy), name: nameOf(support.completedBy) }
      : null,
    createdAt: support.createdAt,
    updatedAt: support.updatedAt,
  };
}

export function serializeUser(user: Record<string, unknown>) {
  return {
    id: idOf(user._id ?? user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? "",
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
