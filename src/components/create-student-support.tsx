"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button, Field, Select } from "@/components/ui";

type SupportType = { id: string; name: string };
type Moderator = { id: string; name: string };

type StudentRef = {
  id: string;
  name: string;
  studentNumber: string;
};

export function CreateStudentSupport({
  student,
  students,
  open,
  onClose,
  onCreated,
}: {
  student?: StudentRef | null;
  students?: StudentRef[];
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const selectedStudents = (students?.length ? students : student ? [student] : []).filter(Boolean);
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([]);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [supportType, setSupportType] = useState("");
  const [priority, setPriority] = useState("medium");
  const [moderatorId, setModeratorId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api<{ supportTypes: SupportType[] }>("/api/lookups"),
      api<Moderator[]>("/api/users?role=moderator"),
    ])
      .then(([lookups, users]) => {
        setSupportTypes(lookups.supportTypes);
        setSupportType((current) => current || lookups.supportTypes[0]?.id || "");
        setModerators(users);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load form data"));
  }, [open]);

  if (!open || !selectedStudents.length) return null;

  async function create() {
    if (!supportType) {
      toast.error("Select a support type");
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ createdCount: number }>("/api/supports", {
        method: "POST",
        body: JSON.stringify({
          studentIds: selectedStudents.map((item) => item.id),
          supportType,
          priority,
          moderatorId,
        }),
      });
      const assigned = moderators.find((item) => item.id === moderatorId)?.name;
      const label = result.createdCount > 1 ? "supports" : "support";
      toast.success(
        assigned
          ? `${result.createdCount} ${label} created and assigned to ${assigned}`
          : `${result.createdCount} ${label} created`
      );
      onCreated?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create support");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#17302c]/40 p-4" onClick={onClose}>
      <div
        className="mx-auto mt-16 max-w-md rounded-3xl border border-[#ddd4c4] bg-[#fffdf8] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f5c56]">New support</p>
        <h2 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl text-[#17302c]">
          {selectedStudents.length === 1 ? selectedStudents[0].name : `${selectedStudents.length} students`}
        </h2>
        <p className="mt-1 text-sm text-[#5d6f6b]">
          {selectedStudents.length === 1
            ? `S-Number ${selectedStudents[0].studentNumber}`
            : selectedStudents.map((item) => item.name).join(", ")}
        </p>
        <div className="mt-5 space-y-3">
          <Field label="Support type">
            <Select value={supportType} onChange={(event) => setSupportType(event.target.value)}>
              {supportTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
          <Field label="Assign moderator">
            <Select value={moderatorId} onChange={(event) => setModeratorId(event.target.value)}>
              <option value="">Unassigned</option>
              {moderators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !supportType} onClick={create}>
            {saving ? "Creating…" : moderatorId ? "Create & assign" : "Create support"}
          </Button>
        </div>
      </div>
    </div>
  );
}
