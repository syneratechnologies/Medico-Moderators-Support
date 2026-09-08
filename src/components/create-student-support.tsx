"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button, Field, Input, Select } from "@/components/ui";

type SupportType = { id: string; name: string };
type Moderator = { id: string; name: string };

type StudentRef = {
  id: string;
  name: string;
  studentNumber: string;
  roll?: string;
};

export function CreateStudentSupport({
  student,
  students,
  open,
  onClose,
  onCreated,
  defaultModeratorId,
  lockModerator,
}: {
  student?: StudentRef | null;
  students?: StudentRef[];
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultModeratorId?: string;
  lockModerator?: boolean;
}) {
  const presetStudents = (students?.length ? students : student ? [student] : []).filter(Boolean);
  const pickMode = !presetStudents.length;
  const [picked, setPicked] = useState<StudentRef[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StudentRef[]>([]);
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([]);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [supportType, setSupportType] = useState("");
  const [priority, setPriority] = useState("medium");
  const [moderatorId, setModeratorId] = useState(defaultModeratorId ?? "");
  const [saving, setSaving] = useState(false);

  const selectedStudents = pickMode ? picked : presetStudents;

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setQuery("");
    setHits([]);
    setModeratorId(defaultModeratorId ?? "");
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
  }, [open, defaultModeratorId]);

  useEffect(() => {
    if (!open || !pickMode) return;
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      api<{ items: StudentRef[] }>(`/api/students?q=${encodeURIComponent(q)}&limit=10`)
        .then((data) => setHits(data.items))
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, pickMode, query]);

  if (!open) return null;

  function addStudent(item: StudentRef) {
    setPicked((current) => (current.some((row) => row.id === item.id) ? current : [...current, item]));
    setQuery("");
    setHits([]);
  }

  async function create() {
    if (!selectedStudents.length) {
      toast.error("Select a student first");
      return;
    }
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

  const lockedName = moderators.find((item) => item.id === moderatorId)?.name;

  return (
    <div className="fixed inset-0 z-50 bg-[#17302c]/40 p-4" onClick={onClose}>
      <div
        className="mx-auto mt-10 max-h-[90vh] max-w-md overflow-auto rounded-3xl border border-[#ddd4c4] bg-[#fffdf8] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f5c56]">New support</p>
        <h2 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl text-[#17302c]">
          {selectedStudents.length === 1
            ? selectedStudents[0].name
            : selectedStudents.length
              ? `${selectedStudents.length} students`
              : "Assign a student"}
        </h2>
        <p className="mt-1 text-sm text-[#5d6f6b]">
          {selectedStudents.length === 1
            ? `S-Number ${selectedStudents[0].studentNumber || "—"}`
            : selectedStudents.length
              ? `${selectedStudents.slice(0, 3).map((item) => item.name).join(", ")}${
                  selectedStudents.length > 3 ? ` +${selectedStudents.length - 3} more` : ""
                }`
              : "Search by name, roll or S-Number"}
        </p>
        <div className="mt-5 space-y-3">
          {pickMode ? (
            <Field label="Student">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search student"
              />
              {hits.length ? (
                <div className="mt-2 max-h-40 overflow-auto rounded-2xl border border-[#eee4d4] bg-white">
                  {hits.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f1e6]"
                      onClick={() => addStudent(item)}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="mt-0.5 block text-xs text-[#5d6f6b]">
                        Roll {item.roll || "—"} · S-Number {item.studentNumber || "—"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {picked.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {picked.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="rounded-full bg-[#f7f1e6] px-3 py-1 text-xs"
                      onClick={() => setPicked((current) => current.filter((row) => row.id !== item.id))}
                    >
                      {item.name} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </Field>
          ) : null}
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
          {lockModerator ? (
            <p className="rounded-2xl bg-[#f7f1e6] px-3 py-2 text-sm">
              Assigned to <span className="font-medium">{lockedName || "this moderator"}</span>
            </p>
          ) : (
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
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !supportType || !selectedStudents.length} onClick={create}>
            {saving ? "Creating…" : moderatorId ? "Create & assign" : "Create support"}
          </Button>
        </div>
      </div>
    </div>
  );
}
