"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreateStudentSupport } from "@/components/create-student-support";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, Card, Field, Input, Select, TableWrap } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";

type Lookups = {
  branches: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  batches: { id: string; name: string }[];
};

type Student = {
  id: string;
  name: string;
  roll: string;
  serial: string;
  studentNumber: string;
  guardianPhone: string;
  branch: { id: string; name: string };
  group: { id: string; name: string };
  batch: { id: string; name: string };
};

type SupportRow = {
  id: string;
  status: string;
  outcome: string;
  createdAt: string;
  supportType: { name: string };
  assignedModerator: { id: string; name: string } | null;
};

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [supports, setSupports] = useState<SupportRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [addingSupport, setAddingSupport] = useState(false);
  const [moderators, setModerators] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkModerator, setBulkModerator] = useState("");

  async function load() {
    const [look, data, session] = await Promise.all([
      api<Lookups>("/api/lookups"),
      api<{ student: Student; supports: SupportRow[] }>(`/api/students/${params.id}`),
      api<{ user: { role: string } }>("/api/auth/me"),
    ]);
    const editable = session.user.role !== "moderator";
    setCanEdit(editable);
    setLookups(look);
    setStudent(data.student);
    setSupports(data.supports);
    setSelected([]);
    if (editable) {
      const users = await api<Array<{ id: string; name: string }>>("/api/users?role=moderator");
      setModerators(users);
      if (!bulkModerator && users[0]) setBulkModerator(users[0].id);
    }
    setForm({
      name: data.student.name,
      roll: data.student.roll,
      serial: data.student.serial,
      studentNumber: data.student.studentNumber,
      guardianPhone: data.student.guardianPhone,
      branch: data.student.branch.id,
      group: data.student.group.id,
      batch: data.student.batch.id,
    });
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [params.id]);

  async function changeModerator(supportIds: string[], moderatorId: string) {
    if (!supportIds.length) return toast.error("Select a support first");
    try {
      await api("/api/supports/assign", {
        method: "POST",
        body: JSON.stringify({
          supportIds,
          moderatorId,
          reopenCompleted: true,
        }),
      });
      toast.success(moderatorId ? "Moderator updated" : "Support unassigned");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change moderator");
    }
  }

  async function deleteSupports(supportIds: string[]) {
    if (!supportIds.length) return toast.error("Select a support first");
    if (!window.confirm(`Delete ${supportIds.length} support${supportIds.length > 1 ? "s" : ""}?`)) return;
    try {
      await api("/api/supports/delete", {
        method: "POST",
        body: JSON.stringify({ supportIds }),
      });
      toast.success("Support deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete support");
    }
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function save() {
    try {
      await api(`/api/students/${params.id}`, { method: "PATCH", body: JSON.stringify(form) });
      toast.success("Profile updated");
      setEditing(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  if (!student) return <p>Loading profile…</p>;

  return (
    <div>
      {!canEdit ? (
        <Link
          href="/students"
          className="mb-2 inline-flex min-h-10 items-center text-sm font-medium text-[#0f5c56] md:hidden"
        >
          ← Students
        </Link>
      ) : null}
      <PageHeader
        eyebrow="Lifetime profile"
        title={student.name}
        description={`${student.studentNumber} · Roll ${student.roll} · ${student.branch.name}`}
        actions={
          canEdit ? (
            <>
              <Button variant="secondary" onClick={() => setEditing((value) => !value)}>
                {editing ? "Cancel" : "Edit profile"}
              </Button>
              <Button onClick={() => setAddingSupport(true)}>Add support</Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card className="p-4 md:p-5">
          {editing ? (
            <div className="space-y-3">
              {([
                ["name", "Name"],
                ["roll", "Roll"],
                ["serial", "Serial"],
                ["studentNumber", "S-Number"],
                ["guardianPhone", "G-Number"],
              ] as const).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                </Field>
              ))}
              <Field label="Branch">
                <Select value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })}>
                  {lookups?.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </Field>
              <Field label="Group">
                <Select value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })}>
                  {lookups?.groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </Field>
              <Field label="Batch">
                <Select value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })}>
                  {lookups?.batches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={save}>Save profile</Button>
                <Button variant="secondary" type="button" onClick={() => setAddingSupport(true)}>
                  New support
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[11px] uppercase text-[#5d6f6b]">S-Number</dt><dd className="font-medium">{student.studentNumber}</dd></div>
              <div><dt className="text-[11px] uppercase text-[#5d6f6b]">G-Number</dt><dd className="font-medium">{student.guardianPhone}</dd></div>
              <div><dt className="text-[11px] uppercase text-[#5d6f6b]">Roll / Serial</dt><dd>{student.roll} / {student.serial}</dd></div>
              <div><dt className="text-[11px] uppercase text-[#5d6f6b]">Branch</dt><dd>{student.branch.name}</dd></div>
              <div className="col-span-2"><dt className="text-[11px] uppercase text-[#5d6f6b]">Group / Batch</dt><dd>{student.group.name} · {student.batch.name}</dd></div>
            </dl>
          )}
        </Card>

        <Card className="p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-fraunces)] text-xl md:text-2xl">Support history</h2>
            {canEdit ? (
              <Button type="button" onClick={() => setAddingSupport(true)}>
                New support
              </Button>
            ) : null}
          </div>
          {canEdit && selected.length ? (
            <div className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl bg-[#f7f1e6] px-3 py-2">
              <p className="mr-auto text-sm">{selected.length} selected</p>
              <Select value={bulkModerator} onChange={(event) => setBulkModerator(event.target.value)}>
                <option value="">Unassigned</option>
                {moderators.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
              <Button type="button" onClick={() => changeModerator(selected, bulkModerator)}>
                Change moderator
              </Button>
              <Button variant="danger" type="button" onClick={() => deleteSupports(selected)}>
                Delete
              </Button>
            </div>
          ) : null}
          <div className="space-y-2 md:hidden">
            {supports.length ? (
              supports.map((item) => (
                <Link
                  key={item.id}
                  href={`/supports/${item.id}`}
                  className="block rounded-2xl border border-[#eee4d4] bg-white px-4 py-3.5 active:bg-[#f7f1e6]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{item.supportType.name}</p>
                      <p className="mt-0.5 text-xs text-[#5d6f6b]">
                        {formatDate(item.createdAt)}
                        {item.assignedModerator ? ` · ${item.assignedModerator.name}` : ""}
                      </p>
                      {item.outcome ? (
                        <p className="mt-2 line-clamp-2 text-sm text-[#5d6f6b]">{item.outcome}</p>
                      ) : null}
                    </div>
                    <StatusBadge value={item.status} />
                  </div>
                </Link>
              ))
            ) : (
              <p className="py-6 text-sm text-[#5d6f6b]">No supports yet.</p>
            )}
          </div>
          <div className="hidden md:block">
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-[#5d6f6b]">
                <tr>
                  {canEdit ? (
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={supports.length > 0 && supports.every((item) => selected.includes(item.id))}
                        onChange={(event) => setSelected(event.target.checked ? supports.map((item) => item.id) : [])}
                      />
                    </th>
                  ) : null}
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Support</th>
                  <th className="px-3 py-2">Moderator</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Outcome</th>
                  {canEdit ? <th className="px-3 py-2"></th> : null}
                </tr>
              </thead>
              <tbody>
                {supports.map((item) => (
                  <tr key={item.id} className="border-t border-[#eee4d4]">
                    {canEdit ? (
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                      </td>
                    ) : null}
                    <td className="px-3 py-3">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Link href={`/supports/${item.id}`} className="hover:underline">{item.supportType.name}</Link>
                    </td>
                    <td className="px-3 py-3">
                      {canEdit ? (
                        <div className="space-y-1">
                          {item.assignedModerator ? (
                            <Link href={`/moderators/${item.assignedModerator.id}`} className="text-xs font-medium text-[#0f5c56] hover:underline">
                              {item.assignedModerator.name}
                            </Link>
                          ) : null}
                          <Select
                            value={item.assignedModerator?.id ?? ""}
                            onChange={(event) => changeModerator([item.id], event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {moderators.map((moderator) => (
                              <option key={moderator.id} value={moderator.id}>{moderator.name}</option>
                            ))}
                          </Select>
                        </div>
                      ) : item.assignedModerator ? (
                        <span>{item.assignedModerator.name}</span>
                      ) : (
                        "Unassigned"
                      )}
                    </td>
                    <td className="px-3 py-3"><StatusBadge value={item.status} /></td>
                    <td className="px-3 py-3">{item.outcome || "—"}</td>
                    {canEdit ? (
                      <td className="px-3 py-3">
                        <Button variant="danger" type="button" onClick={() => deleteSupports([item.id])}>
                          Delete
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          </div>
        </Card>
      </div>
      <CreateStudentSupport
        student={student}
        open={addingSupport}
        onClose={() => setAddingSupport(false)}
        onCreated={() => {
          load().catch((error) => toast.error(error.message));
        }}
      />
    </div>
  );
}
