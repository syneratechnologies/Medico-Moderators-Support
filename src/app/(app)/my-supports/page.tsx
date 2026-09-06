"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SupportQueueCard } from "@/components/mobile-cards";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, Card, Input, Select, TableWrap } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

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

type SortKey = "newest" | "oldest" | "student" | "type" | "priority";

const STAGE_ORDER: Record<string, number> = {
  pending: 0,
  in_progress: 1,
  cancelled: 2,
  completed: 3,
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function compareRows(a: SupportRow, b: SupportRow, sort: SortKey) {
  if (sort === "student") return (a.student.name ?? "").localeCompare(b.student.name ?? "");
  if (sort === "type") return (a.supportType.name ?? "").localeCompare(b.supportType.name ?? "");
  if (sort === "priority") return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
  const aTime = new Date(a.assignedAt || a.createdAt).getTime();
  const bTime = new Date(b.assignedAt || b.createdAt).getTime();
  return sort === "oldest" ? aTime - bTime : bTime - aTime;
}

function sortQueue(items: SupportRow[], sort: SortKey) {
  return [...items].sort((a, b) => {
    const stage = (STAGE_ORDER[a.status] ?? 9) - (STAGE_ORDER[b.status] ?? 9);
    if (stage !== 0) return stage;
    return compareRows(a, b, sort);
  });
}

export default function ModeratorSupportsPage() {
  const [items, setItems] = useState<SupportRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("status") ?? "";
    if (next) setStatus(next);
    api<{ items: SupportRow[] }>("/api/supports?limit=500")
      .then((data) => setItems(data.items))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load supports"));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (status && item.status !== status) return false;
      if (!q) return true;
      const text = `${item.student.name ?? ""} ${item.student.studentNumber ?? ""} ${item.supportType.name}`.toLowerCase();
      return text.includes(q);
    });
  }, [items, query, status]);

  const rows = useMemo(() => sortQueue(filtered, sort), [filtered, sort]);
  const active = rows.filter((item) => item.status === "pending" || item.status === "in_progress");
  const finished = rows.filter((item) => item.status === "completed" || item.status === "cancelled");

  return (
    <div>
      <PageHeader
        title="My supports"
        description="Pending work stays at the top. Completed cases always stay at the bottom."
      />
      <Card className="mb-4 p-3 md:p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Student, S-Number, type"
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All stages</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="student">Student name</option>
            <option value="type">Support type</option>
            <option value="priority">Priority</option>
          </Select>
        </div>
      </Card>

      <Section title="Pending & in progress" hint="These stay at the top" rows={active} />
      <div className="mt-4">
        <Section title="Completed" hint="Finished work always stays at the bottom" rows={finished} />
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  rows,
}: {
  title: string;
  hint: string;
  rows: SupportRow[];
}) {
  return (
    <Card className="p-3 md:p-4">
      <div className="mb-3">
        <h2 className="font-[family-name:var(--font-fraunces)] text-xl md:text-2xl">{title}</h2>
        <p className="text-xs text-[#5d6f6b]">{hint} · {rows.length} cases</p>
      </div>
      <div className="space-y-2 md:hidden">
        {rows.length ? (
          rows.map((item) => (
            <SupportQueueCard
              key={item.id}
              id={item.id}
              studentName={item.student.name}
              studentNumber={item.student.studentNumber}
              supportType={item.supportType.name}
              status={item.status}
              priority={item.priority}
              when={item.assignedAt || item.createdAt}
            />
          ))
        ) : (
          <p className="px-1 py-6 text-sm text-[#5d6f6b]">No supports in this section.</p>
        )}
      </div>
      <div className="hidden md:block">
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-[#5d6f6b]">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">S-Number</th>
                <th className="px-3 py-2">Support</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Assigned</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((item) => (
                  <tr key={item.id} className="border-t border-[#eee4d4]">
                    <td className="px-3 py-3 font-medium">{item.student.name}</td>
                    <td className="px-3 py-3">{item.student.studentNumber}</td>
                    <td className="px-3 py-3">{item.supportType.name}</td>
                    <td className="px-3 py-3">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="px-3 py-3 capitalize">{item.priority}</td>
                    <td className="px-3 py-3">{formatDateTime(item.assignedAt || item.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Link href={`/supports/${item.id}`}>
                        <Button variant="secondary" type="button">Open</Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-[#5d6f6b]" colSpan={7}>
                    No supports in this section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </Card>
  );
}
