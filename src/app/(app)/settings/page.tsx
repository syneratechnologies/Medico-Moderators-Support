"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/client";

type Lookups = {
  branches: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  batches: { id: string; name: string }[];
  supportTypes: { id: string; name: string }[];
};

const kinds = [
  ["branch", "Branches", "branches"],
  ["group", "Groups", "groups"],
  ["batch", "Batches", "batches"],
  ["supportType", "Support types", "supportTypes"],
] as const;

export default function SettingsPage() {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLookups(await api<Lookups>("/api/lookups"));
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, []);

  async function add(kind: string) {
    const name = drafts[kind]?.trim();
    if (!name) return;
    try {
      await api("/api/lookups", { method: "POST", body: JSON.stringify({ kind, name }) });
      setDrafts((current) => ({ ...current, [kind]: "" }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add");
    }
  }

  return (
    <div>
      <PageHeader title="Catalog" description="Branches, groups, batches and support types used across students and imports." />
      <div className="grid gap-4 md:grid-cols-2">
        {kinds.map(([kind, title, key]) => (
          <Card key={kind} className="p-5">
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl">{title}</h2>
            <div className="mt-4 flex gap-2">
              <Input
                value={drafts[kind] ?? ""}
                onChange={(event) => setDrafts({ ...drafts, [kind]: event.target.value })}
                placeholder={`New ${title.toLowerCase()}`}
              />
              <Button onClick={() => add(kind)}>Add</Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {lookups?.[key].map((item) => (
                <span key={item.id} className="rounded-full bg-[#f7f1e6] px-3 py-1 text-sm">
                  {item.name}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
