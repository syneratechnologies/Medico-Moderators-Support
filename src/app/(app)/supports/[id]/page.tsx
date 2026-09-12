"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, CallButton, Card, Field, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime, shortPlacement } from "@/lib/utils";

type Comment = {
  id: string;
  text: string;
  createdAt: string | null;
  updatedAt: string | null;
  deleteStatus?: string;
  createdBy: { id: string; name: string };
};

type Support = {
  id: string;
  status: string;
  priority: string;
  description: string;
  outcome: string;
  comments?: Comment[];
  createdAt: string;
  assignedAt: string | null;
  completedAt: string | null;
  dueDate: string | null;
  supportType: { name: string };
  assignedModerator: { id: string; name: string } | null;
  createdBy: { name: string };
  student: {
    id: string;
    name: string;
    studentNumber: string;
    roll: string;
    serial: string;
    guardianPhone: string;
    branch: { name: string };
    group: { name: string };
    batch: { name: string };
  };
};

export default function SupportDetailPage() {
  const params = useParams<{ id: string }>();
  const [support, setSupport] = useState<Support | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("");
  const [moderators, setModerators] = useState<Array<{ id: string; name: string }>>([]);

  async function load() {
    const [data, session] = await Promise.all([
      api<Support>(`/api/supports/${params.id}`),
      api<{ user: { role: string } }>("/api/auth/me"),
    ]);
    setSupport(data);
    const active = (data.comments ?? []).filter((item) => item.deleteStatus !== "pending");
    setDraft(active[active.length - 1]?.text ?? "");
    setAdding(false);
    setEditingId(null);
    setEditDraft("");
    setRole(session.user.role);
    if (session.user.role !== "moderator") {
      const users = await api<Array<{ id: string; name: string }>>("/api/users?role=moderator");
      setModerators(users);
    }
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [params.id]);

  const comments = useMemo(() => support?.comments ?? [], [support]);
  const active = comments.filter((item) => item.deleteStatus !== "pending");
  const history = adding ? comments : comments.filter((item) => item.id !== active[active.length - 1]?.id);
  const last = adding ? null : active[active.length - 1] ?? null;

  async function saveComment(text: string, commentId?: string, complete = false) {
    if (!text.trim()) {
      toast.error("Write a comment first");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/supports/${params.id}/comment`, {
        method: commentId || (!adding && last) ? "PATCH" : "POST",
        body: JSON.stringify({
          text,
          commentId,
          complete: complete && support?.status !== "cancelled",
        }),
      });
      toast.success("Updated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    } finally {
      setSaving(false);
    }
  }

  async function update() {
    await saveComment(draft, adding || !last ? undefined : last.id, true);
  }

  async function updatePrevious() {
    if (!editingId) return;
    await saveComment(editDraft, editingId, false);
  }

  async function requestDelete(commentId: string) {
    if (!window.confirm("Send this comment to manager for delete approval?")) return;
    setSaving(true);
    try {
      await api(`/api/supports/${params.id}/comment?commentId=${encodeURIComponent(commentId)}`, {
        method: "DELETE",
      });
      toast.success("Sent to manager for approval");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request delete");
    } finally {
      setSaving(false);
    }
  }

  async function reviewDelete(commentId: string, decision: "approve" | "reject") {
    setSaving(true);
    try {
      await api(`/api/supports/${params.id}/comment`, {
        method: "PUT",
        body: JSON.stringify({ commentId, decision }),
      });
      toast.success(decision === "approve" ? "Comment deleted" : "Delete request rejected");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review delete");
    } finally {
      setSaving(false);
    }
  }

  if (!support) return <p className="py-8 text-sm text-[#5d6f6b]">Loading support…</p>;

  const isModerator = role === "moderator";
  const canReview = role === "super_admin" || role === "manager";
  const canWork = support.status !== "cancelled";
  const placement = shortPlacement([
    support.student.branch?.name,
    support.student.group?.name,
    support.student.batch?.name,
  ]);

  return (
    <div className={isModerator ? "pb-24 md:pb-0" : ""}>
      {isModerator ? (
        <Link
          href="/my-supports"
          className="mb-2 inline-flex min-h-10 items-center text-sm font-medium text-[#0f5c56] md:hidden"
        >
          ← Supports
        </Link>
      ) : null}
      <PageHeader
        eyebrow="Support case"
        title={support.supportType.name}
        description={support.description || undefined}
        actions={<StatusBadge value={support.status} />}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="order-1 space-y-4 xl:order-2">
          <Card className="p-4 md:p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5d6f6b]">Student</h3>
            <p className="text-lg font-semibold leading-snug">
              <Link href={`/students/${support.student.id}`} className="hover:underline">
                {support.student.name}
              </Link>
            </p>
            <p className="mt-1 text-sm text-[#5d6f6b]">{placement}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase text-[#5d6f6b]">S-Number</p>
                <p className="font-medium">{support.student.studentNumber || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-[#5d6f6b]">G-Number</p>
                <p className="font-medium">{support.student.guardianPhone || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-[#5d6f6b]">Roll / Serial</p>
                <p>{support.student.roll} · {support.student.serial}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-[#5d6f6b]">Branch / Group / Batch</p>
                <p>{placement}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <CallButton label="Call student" value={support.student.studentNumber} />
              <CallButton label="Call guardian" value={support.student.guardianPhone} />
            </div>
          </Card>
          <Card className="p-4 text-sm md:p-5">
            <p>Created by {support.createdBy.name}</p>
            <p className="text-[#5d6f6b]">{formatDateTime(support.createdAt)}</p>
            {role !== "moderator" ? (
              <div className="mt-3">
                <Field label="Assigned moderator">
                  <Select
                    value={support.assignedModerator?.id ?? ""}
                    onChange={async (event) => {
                      try {
                        await api("/api/supports/assign", {
                          method: "POST",
                          body: JSON.stringify({ supportIds: [support.id], moderatorId: event.target.value }),
                        });
                        toast.success(event.target.value ? "Moderator changed" : "Support unassigned");
                        await load();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not change moderator");
                      }
                    }}
                  >
                    <option value="">Unassigned</option>
                    {moderators.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : (
              <p className="mt-3">Moderator: {support.assignedModerator?.name ?? "Unassigned"}</p>
            )}
            <p className="text-[#5d6f6b]">Assigned {formatDateTime(support.assignedAt)}</p>
            <p className="mt-3 capitalize">Priority: {support.priority}</p>
            <p>Due: {formatDateTime(support.dueDate)}</p>
            <p>Completed: {formatDateTime(support.completedAt)}</p>
            {!isModerator && support.status !== "cancelled" && support.status !== "completed" ? (
              <Button
                variant="ghost"
                className="mt-3"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await api(`/api/supports/${support.id}/status`, {
                      method: "PATCH",
                      body: JSON.stringify({ status: "cancelled" }),
                    });
                    toast.success("Support cancelled");
                    await load();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not cancel");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Cancel support
              </Button>
            ) : null}
          </Card>
        </div>
        <Card className="order-2 p-4 md:p-6 xl:order-1">
          <h2 className="font-[family-name:var(--font-fraunces)] text-xl md:text-2xl">Comments</h2>
          <p className="mt-2 text-sm text-[#5d6f6b]">
            Keep old notes. Previous comments can be edited. Add a new comment for the next call.
          </p>
          <div className="mt-4 space-y-3">
            {history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[#eee6d8] bg-[#fbf7f0] px-3 py-3">
                {editingId === item.id ? (
                  <Textarea rows={4} value={editDraft} onChange={(event) => setEditDraft(event.target.value)} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{item.text}</p>
                )}
                <p className="mt-2 text-xs text-[#5d6f6b]">
                  {item.createdBy.name} · {formatDateTime(item.updatedAt || item.createdAt)}
                </p>
                {item.deleteStatus === "pending" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium text-[#8a5a12]">Waiting for manager approval</p>
                    {canReview ? (
                      <>
                        <Button type="button" disabled={saving} onClick={() => reviewDelete(item.id, "approve")}>
                          Approve
                        </Button>
                        <Button type="button" variant="secondary" disabled={saving} onClick={() => reviewDelete(item.id, "reject")}>
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editingId === item.id ? (
                      <>
                        <Button type="button" disabled={saving || !editDraft.trim()} onClick={updatePrevious}>
                          Update
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft("");
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={saving}
                          onClick={() => {
                            setEditingId(item.id);
                            setEditDraft(item.text);
                          }}
                        >
                          Edit
                        </Button>
                        <Button type="button" variant="danger" disabled={saving} onClick={() => requestDelete(item.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="rounded-2xl border border-[#ddd4c4] bg-white px-3 py-3">
              <Field label={adding || !last ? "New comment" : "Last comment"}>
                <Textarea
                  rows={5}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="What happened on this call?"
                />
              </Field>
              <div className={isModerator ? "mt-3 hidden flex-wrap gap-2 md:flex" : "mt-3 flex flex-wrap gap-2"}>
                <Button disabled={saving || !draft.trim() || !canWork} onClick={update}>
                  Update
                </Button>
                {last ? (
                  <Button type="button" variant="danger" disabled={saving} onClick={() => requestDelete(last.id)}>
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {last && !adding ? (
            <button
              type="button"
              className="mt-3 text-sm font-medium text-[#0f5c56] hover:underline"
              onClick={() => {
                setAdding(true);
                setDraft("");
              }}
            >
              + New comment
            </button>
          ) : null}
        </Card>
      </div>

      {isModerator ? (
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ddd4c4] bg-[#fffdf8]/95 p-3 backdrop-blur md:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <Button className="w-full" disabled={saving || !draft.trim() || !canWork} onClick={update}>
            Update
          </Button>
        </div>
      ) : null}
    </div>
  );
}
