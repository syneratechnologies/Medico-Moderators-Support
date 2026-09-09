"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, CallButton, Card, Field, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

type Support = {
  id: string;
  status: string;
  priority: string;
  description: string;
  outcome: string;
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
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("");
  const [moderators, setModerators] = useState<Array<{ id: string; name: string }>>([]);

  async function load() {
    const [data, session] = await Promise.all([
      api<Support>(`/api/supports/${params.id}`),
      api<{ user: { role: string } }>("/api/auth/me"),
    ]);
    setSupport(data);
    setOutcome(data.outcome ?? "");
    setRole(session.user.role);
    if (session.user.role !== "moderator") {
      const users = await api<Array<{ id: string; name: string }>>("/api/users?role=moderator");
      setModerators(users);
    }
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [params.id]);

  async function saveComment() {
    if (!outcome.trim()) {
      toast.error("Write a comment first");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/supports/${params.id}/comment`, {
        method: "PATCH",
        body: JSON.stringify({ outcome }),
      });
      toast.success("Comment saved");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save comment");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: "in_progress" | "completed" | "cancelled") {
    if (status === "completed" && !outcome.trim()) {
      toast.error("Outcome / note is mandatory before completing");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/supports/${params.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, outcome }),
      });
      toast.success(status === "completed" ? "Support completed" : "Status updated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (!support) return <p className="py-8 text-sm text-[#5d6f6b]">Loading support…</p>;

  const isModerator = role === "moderator";
  const canWork = support.status !== "completed" && support.status !== "cancelled";

  const actions = (
    <>
      <Button variant="secondary" className="w-full md:w-auto" disabled={saving || !outcome.trim()} onClick={saveComment}>
        Save comment
      </Button>
            {support.status === "pending" ? (
              <Button className="w-full md:w-auto" disabled={saving} onClick={() => updateStatus("in_progress")}>
                Start work
              </Button>
            ) : null}
            {canWork ? (
              <Button className="w-full md:w-auto" disabled={saving || !outcome.trim()} onClick={() => updateStatus("completed")}>
                Mark as completed
              </Button>
            ) : null}
      {!isModerator && canWork ? (
        <Button variant="secondary" className="w-full md:w-auto" disabled={saving} onClick={() => updateStatus("cancelled")}>
          Cancel
        </Button>
      ) : null}
    </>
  );

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
                <p className="text-[11px] uppercase text-[#5d6f6b]">Placement</p>
                <p>{support.student.branch?.name}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#5d6f6b]">
              {support.student.group?.name} · {support.student.batch?.name}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-white">
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
          </Card>
        </div>
        <Card className="order-2 p-4 md:p-6 xl:order-1">
          <h2 className="font-[family-name:var(--font-fraunces)] text-xl md:text-2xl">Work & outcome</h2>
          <p className="mt-2 text-sm text-[#5d6f6b]">
            {role === "moderator"
              ? "Start the case, then write a mandatory note before marking it complete."
              : "Write a comment, then complete the case. A note is required."}
          </p>
          <div className="mt-5">
            <Field label="Comment / note">
              <Textarea
                rows={6}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                placeholder="What happened? What was collected or decided?"
              />
            </Field>
          </div>
          <div className={isModerator ? "mt-4 hidden flex-wrap gap-2 md:flex" : "mt-4 flex flex-wrap gap-2"}>
            {actions}
          </div>
        </Card>
      </div>

      {isModerator ? (
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ddd4c4] bg-[#fffdf8]/95 p-3 backdrop-blur md:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={saving || !outcome.trim()} onClick={saveComment}>
              Save
            </Button>
            {support.status === "pending" ? (
              <Button disabled={saving} onClick={() => updateStatus("in_progress")}>
                Start
              </Button>
            ) : canWork ? (
              <Button disabled={saving} onClick={() => updateStatus("completed")}>
                Complete
              </Button>
            ) : (
              <Button variant="secondary" disabled>
                Done
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
