"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/client";

type LookupItem = { id: string; name: string };
type Lookups = {
  branches: LookupItem[];
  groups: LookupItem[];
  batches: LookupItem[];
  supportTypes: LookupItem[];
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
  const [editing, setEditing] = useState<{ kind: string; id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLookups(await api<Lookups>("/api/lookups"));
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, []);

  async function add(kind: string) {
    const name = drafts[kind]?.trim();
    if (!name) return;
    setBusy(`${kind}:add`);
    try {
      await api("/api/lookups", { method: "POST", body: JSON.stringify({ kind, name }) });
      setDrafts((current) => ({ ...current, [kind]: "" }));
      toast.success("Added");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add");
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return toast.error("Name cannot be empty");
    setBusy(`${editing.kind}:${editing.id}`);
    try {
      await api("/api/lookups", {
        method: "PATCH",
        body: JSON.stringify({ kind: editing.kind, id: editing.id, name }),
      });
      toast.success("Updated");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: string, item: LookupItem) {
    const extra =
      kind === "supportType"
        ? "Only unused types can be deleted."
        : "Students using it will keep their other data, but this field will be cleared.";
    if (!window.confirm(`Delete “${item.name}”? ${extra}`)) return;
    setBusy(`${kind}:${item.id}`);
    try {
      const result = await api<{ unlinked: number }>(
        `/api/lookups?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(item.id)}`,
        { method: "DELETE" }
      );
      if (editing?.id === item.id) setEditing(null);
      toast.success(result.unlinked ? `Deleted. Cleared from ${result.unlinked} student${result.unlinked === 1 ? "" : "s"}.` : "Deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
    } finally {
      setBusy(null);
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
                onKeyDown={(event) => {
                  if (event.key === "Enter") add(kind);
                }}
                placeholder={`New ${title.toLowerCase()}`}
              />
              <Button disabled={busy === `${kind}:add`} onClick={() => add(kind)}>
                Add
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {(lookups?.[key] ?? []).map((item) => {
                const isEditing = editing?.kind === kind && editing.id === item.id;
                const itemBusy = busy === `${kind}:${item.id}`;
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#eee6d8] bg-[#fbf7f0] px-3 py-2"
                  >
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editing.name}
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveEdit();
                          if (event.key === "Escape") setEditing(null);
                        }}
                        className="min-w-[140px] flex-1"
                      />
                    ) : (
                      <p className="min-w-[140px] flex-1 text-sm font-medium">{item.name}</p>
                    )}
                    <div className="flex gap-1">
                      {isEditing ? (
                        <>
                          <Button type="button" disabled={itemBusy} onClick={saveEdit}>
                            Save
                          </Button>
                          <Button type="button" variant="ghost" disabled={itemBusy} onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={Boolean(busy)}
                            onClick={() => setEditing({ kind, id: item.id, name: item.name })}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            disabled={Boolean(busy)}
                            onClick={() => remove(kind, item)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {lookups && !lookups[key].length ? (
                <p className="text-sm text-[#5d6f6b]">None yet.</p>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
