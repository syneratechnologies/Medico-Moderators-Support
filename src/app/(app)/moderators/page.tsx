"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Card, Input } from "@/components/ui";
import { api } from "@/lib/client";

const PAGE_SIZE = 12;

type ModeratorCard = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
};

export default function ModeratorsPage() {
  const [moderators, setModerators] = useState<ModeratorCard[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api<{ moderators: ModeratorCard[] }>("/api/supports/workload")
      .then((data) => setModerators(data.moderators))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load moderators"));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return moderators;
    return moderators.filter((item) =>
      `${item.name} ${item.email ?? ""} ${item.phone ?? ""}`.toLowerCase().includes(q)
    );
  }, [moderators, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Moderators"
        description="Open a moderator to see assigned work, current stage, and reassign cases."
      />
      <Card className="mb-4 p-3 md:p-4">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search name, email or phone"
        />
      </Card>
      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <Link key={item.id} href={`/moderators/${item.id}`}>
              <Card className="h-full p-5 transition hover:border-[#0f5c56]/40">
                <p className="font-[family-name:var(--font-fraunces)] text-2xl">{item.name}</p>
                <p className="mt-1 text-sm text-[#5d6f6b]">{item.email}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <p>Pending <span className="font-medium">{item.pending}</span></p>
                  <p>In progress <span className="font-medium">{item.inProgress}</span></p>
                  <p>Completed <span className="font-medium">{item.completed}</span></p>
                  <p>Total <span className="font-medium">{item.total}</span></p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-8 text-sm text-[#5d6f6b]">No moderators match this search.</p>
      )}
      <Pagination page={currentPage} pages={pages} total={filtered.length} onPage={setPage} />
    </div>
  );
}
