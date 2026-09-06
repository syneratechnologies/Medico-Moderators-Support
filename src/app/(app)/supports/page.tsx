"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SupportSheet } from "@/components/support-sheet";
import { api } from "@/lib/client";

type Lookups = {
  branches: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  batches: { id: string; name: string }[];
  supportTypes: { id: string; name: string }[];
};

export default function SupportsPage() {
  const router = useRouter();
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    api<Lookups>("/api/lookups").then(setLookups);
    api<{ user: { role: string } }>("/api/auth/me").then((data) => {
      if (data.user.role === "moderator") {
        router.replace("/dashboard");
        return;
      }
      setCanEdit(true);
    });
  }, [router]);

  return (
    <div>
      <PageHeader
        title="Student import"
        description="Import Excel or type rows to create new students. Existing S-Numbers are skipped. Create supports from the Students page."
      />
      <SupportSheet lookups={lookups} canEdit={canEdit} />
    </div>
  );
}
