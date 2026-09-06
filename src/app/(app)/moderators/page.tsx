"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { api } from "@/lib/client";

type ModeratorCard = {
  id: string;
  name: string;
  email?: string;
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
};

export default function ModeratorsPage() {
  const [moderators, setModerators] = useState<ModeratorCard[]>([]);

  useEffect(() => {
    api<{ moderators: ModeratorCard[] }>("/api/supports/workload")
      .then((data) => setModerators(data.moderators))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load moderators"));
  }, []);

  return (
    <div>
      <PageHeader
        title="Moderators"
        description="Open a moderator to see assigned work, current stage, and reassign cases."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {moderators.map((item) => (
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
    </div>
  );
}
