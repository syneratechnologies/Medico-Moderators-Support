"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CreateStudentSupport } from "@/components/create-student-support";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, Card, Select, TableWrap, TelLink } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

type Moderator = {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
};

type SupportRow = {
  id: string;
  status: string;
  priority: string;
  outcome: string;
  createdAt: string;
  assignedAt: string | null;
  completedAt: string | null;
  supportType: { name: string };
  student: { id?: string; name?: string; studentNumber?: string };
};

const STAGE_ORDER: Record<string, number> = {
  pending: 0,
  in_progress: 1,
  cancelled: 2,
  completed: 3,
};

function sortSupports(items: SupportRow[]) {
  return [...items].sort((a, b) => {
    const stage = (STAGE_ORDER[a.status] ?? 9) - (STAGE_ORDER[b.status] ?? 9);
    if (stage !== 0) return stage;
    const aTime = new Date(a.assignedAt || a.createdAt).getTime();
    const bTime = new Date(b.assignedAt || b.createdAt).getTime();
    return bTime - aTime;
  });
}

export default function ModeratorDetailPage() {
  const params = useParams<{ id: string }>();
  const [moderator, setModerator] = useState<Moderator | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0 });
  const [items, setItems] = useState<SupportRow[]>([]);
  const [moderators, setModerators] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => sortSupports(items), [items]);
  const active = rows.filter((item) => item.status === "pending" || item.status === "in_progress");
  const finished = rows.filter((item) => item.status === "completed" || item.status === "cancelled");

  async function load() {
    const [profile, supports, users] = await Promise.all([
      api<{ user: Moderator; stats: typeof stats }>(`/api/users/${params.id}`),
      api<{ items: SupportRow[] }>(`/api/supports?moderator=${params.id}&limit=500`),
      api<Array<{ id: string; name: string }>>("/api/users?role=moderator"),
    ]);
    setModerator(profile.user);
    setStats(profile.stats);
    setItems(supports.items);
    setModerators(users.filter((item) => item.id !== params.id));
    if (!target && users.find((item) => item.id !== params.id)) {
      setTarget(users.find((item) => item.id !== params.id)?.id ?? "");
    }
    setSelected([]);
  }

  useEffect(() => {
    load().catch((error) => toast.error(error instanceof Error ? error.message : "Could not load moderator"));
  }, [params.id]);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll(list: SupportRow[]) {
    const ids = list.map((item) => item.id);
    const allOn = ids.every((id) => selected.includes(id));
    setSelected((current) => (allOn ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]));
  }

  async function reassign() {
    if (!selected.length) return toast.error("Select supports to reassign");
    if (!target) return toast.error("Choose a moderator");
    try {
      const result = await api<{ assigned: number; moderator: { name: string } | null }>("/api/supports/assign", {
        method: "POST",
        body: JSON.stringify({
          supportIds: selected,
          moderatorId: target,
          reopenCompleted: true,
        }),
      });
      toast.success(`${result.assigned} support(s) reassigned to ${result.moderator?.name ?? "moderator"}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reassign");
    }
  }

  if (!moderator) return <p>Loading moderator…</p>;

  return (
    <div>
      <PageHeader
        eyebrow="Moderator"
        title={moderator.name}
        description={`${moderator.email}${moderator.phone ? ` · ${moderator.phone}` : ""} · ${moderator.isActive ? "Active" : "Disabled"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setCreating(true)}>
              New support
            </Button>
            <Link href="/moderators">
              <Button variant="secondary">All moderators</Button>
            </Link>
          </div>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Assigned", stats.total],
          ["Pending", stats.pending],
          ["In progress", stats.inProgress],
          ["Completed", stats.completed],
          ["Cancelled", stats.cancelled],
        ].map(([label, value]) => (
          <Card key={String(label)} className="px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[#5d6f6b]">{label}</p>
            <p className="font-[family-name:var(--font-fraunces)] text-3xl">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <p className="mb-1 text-xs uppercase text-[#5d6f6b]">Reassign selected to</p>
            <Select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">Choose moderator</option>
              {moderators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" disabled={!selected.length || !target} onClick={reassign}>
            Reassign {selected.length ? `(${selected.length})` : ""}
          </Button>
          <Button variant="ghost" type="button" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
        <p className="mt-2 text-xs text-[#5d6f6b]">
          Completed cases can be selected and reassigned. They come back as pending for the new moderator.
        </p>
      </Card>

      <Section
        title="New & pending"
        hint="Newest assignments stay at the top"
        rows={active}
        selected={selected}
        onToggle={toggle}
        onToggleAll={() => toggleAll(active)}
      />
      <div className="mt-4">
        <Section
          title="Completed & cancelled"
          hint="Finished work stays at the bottom"
          rows={finished}
          selected={selected}
          onToggle={toggle}
          onToggleAll={() => toggleAll(finished)}
        />
      </div>
      <CreateStudentSupport
        open={creating}
        defaultModeratorId={moderator.id}
        lockModerator
        onClose={() => setCreating(false)}
        onCreated={() => {
          load().catch(() => {});
        }}
      />
    </div>
  );
}

function Section({
  title,
  hint,
  rows,
  selected,
  onToggle,
  onToggleAll,
}: {
  title: string;
  hint: string;
  rows: SupportRow[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl">{title}</h2>
          <p className="text-xs text-[#5d6f6b]">{hint} · {rows.length} cases</p>
        </div>
        {rows.length ? (
          <Button variant="secondary" type="button" onClick={onToggleAll}>
            {rows.every((row) => selected.includes(row.id)) ? "Unselect section" : "Select section"}
          </Button>
        ) : null}
      </div>
      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-[#5d6f6b]">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((row) => selected.includes(row.id))}
                  onChange={onToggleAll}
                />
              </th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">S-Number</th>
              <th className="px-3 py-2">Support</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2">Comment</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item) => (
                <tr key={item.id} className="border-t border-[#eee4d4]">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
                  </td>
                  <td className="px-3 py-3">
                    {item.student.id ? (
                      <Link href={`/students/${item.student.id}`} className="font-medium hover:underline">
                        {item.student.name}
                      </Link>
                    ) : (
                      item.student.name
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <TelLink value={item.student.studentNumber} />
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/supports/${item.id}`} className="hover:underline">
                      {item.supportType.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge value={item.status} />
                  </td>
                  <td className="px-3 py-3">{formatDateTime(item.assignedAt || item.createdAt)}</td>
                  <td className="px-3 py-3 text-[#5d6f6b]">{item.outcome || "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-6 text-[#5d6f6b]" colSpan={7}>
                  No cases in this section.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}
