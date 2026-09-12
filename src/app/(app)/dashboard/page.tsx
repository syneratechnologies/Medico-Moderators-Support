"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChangePassword } from "@/components/change-password";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

type DashboardData = {
  role: string;
  stats: Record<string, number>;
  charts?: {
    byType: { _id: string; count: number }[];
    byBranch: { _id: string; count: number }[];
    performance: { name: string; completed: number; total: number }[];
  };
  activities?: Array<{
    _id: string;
    action: string;
    createdAt: string;
    user?: { name?: string };
  }>;
  recent?: Array<{
    _id: string;
    status: string;
    student?: { name?: string };
    supportType?: { name?: string };
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then(setData);
    api<{ user: { id: string; role: string } }>("/api/auth/me")
      .then((session) => setMe(session.user))
      .catch(() => {});
  }, []);

  if (!data) return <p>Loading dashboard…</p>;

  const cards =
    data.role === "moderator"
      ? [
          ["Assigned", data.stats.assigned],
          ["Pending", data.stats.pending],
          ["In Progress", data.stats.inProgress],
          ["Completed", data.stats.completed],
          ["Overdue", data.stats.overdue],
        ]
      : [
          ["Students", data.stats.students],
          ["Supports", data.stats.supports],
          ["Pending", data.stats.pending],
          ["In Progress", data.stats.inProgress],
          ["Completed", data.stats.completed],
          ["Moderators", data.stats.moderators],
        ];

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={data.role === "moderator" ? "My support queue" : "Support command"}
        description="Live snapshot of student support work across Medico."
        actions={
          <div className="flex flex-wrap gap-2">
            {me ? <ChangePassword userId={me.id} /> : null}
            {data.role === "moderator" ? (
              <Link href="/my-supports" className="w-full md:w-auto">
                <span className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#0f5c56] px-4 text-sm font-medium text-white md:w-auto">
                  Open supports
                </span>
              </Link>
            ) : null}
          </div>
        }
      />
      <div className={data.role === "moderator" ? "grid grid-cols-2 gap-3" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
        {cards.map(([label, value]) => {
          const href =
            data.role === "moderator"
              ? label === "Pending"
                ? "/my-supports?status=pending"
                : label === "In Progress"
                  ? "/my-supports?status=in_progress"
                  : label === "Completed"
                    ? "/my-supports?status=completed"
                    : "/my-supports"
              : null;
          const tile = (
            <Card className="p-4 md:p-5">
              <p className="text-[11px] uppercase tracking-wide text-[#5d6f6b] md:text-xs">{label}</p>
              <p className="mt-1 font-[family-name:var(--font-fraunces)] text-[1.75rem] leading-none md:mt-2 md:text-4xl">
                {value}
              </p>
            </Card>
          );
          return href ? (
            <Link key={String(label)} href={href} className="block active:opacity-80">
              {tile}
            </Link>
          ) : (
            <div key={String(label)}>{tile}</div>
          );
        })}
      </div>

      {data.charts ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-4 font-medium">Support types</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.byType.map((item) => ({ name: item._id, count: item.count }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f5c56" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 font-medium">Branch load</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.byBranch.map((item) => ({ name: item._id, count: item.count }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#c9842a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {data.charts?.performance ? (
          <Card className="p-5">
            <h2 className="mb-4 font-medium">Moderator performance</h2>
            <div className="space-y-3">
              {data.charts.performance.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl bg-[#f7f1e6] px-4 py-3">
                  <span>{item.name}</span>
                  <span className="text-sm text-[#5d6f6b]">
                    {item.completed}/{item.total} completed
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="p-4 md:p-5">
          <h2 className="mb-4 font-medium">{data.recent ? "My recent supports" : "Recent activity"}</h2>
          {data.recent ? (
            <p className="mb-3 text-sm">
              <Link href="/my-supports" className="text-[#0f5c56] hover:underline">
                View all assigned supports
              </Link>
            </p>
          ) : null}
          <div className="space-y-3">
            {data.recent?.map((item) => (
              <Link
                key={item._id}
                href={`/supports/${item._id}`}
                className="flex min-h-14 flex-col gap-2 rounded-2xl bg-[#f7f1e6] px-4 py-3 active:bg-[#efe7d8] sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 text-sm font-medium leading-snug">
                  {item.supportType?.name}
                  <span className="mt-0.5 block font-normal text-[#5d6f6b]">{item.student?.name}</span>
                </span>
                <StatusBadge value={item.status} />
              </Link>
            ))}
            {data.activities?.map((item) => (
              <div key={item._id} className="rounded-2xl bg-[#f7f1e6] px-4 py-3">
                <p className="text-sm">{item.action}</p>
                <p className="text-xs text-[#5d6f6b]">
                  {item.user?.name} · {formatDateTime(item.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
