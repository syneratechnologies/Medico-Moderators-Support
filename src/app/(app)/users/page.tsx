"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button, Card, Field, Input, Select, TableWrap } from "@/components/ui";
import { api, roleLabel } from "@/lib/client";
import { formatDate } from "@/lib/utils";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "manager" | "moderator";
  phone: string;
  isActive: boolean;
  createdAt: string;
};

const PAGE_SIZE = 15;

export default function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [me, setMe] = useState<{ role: string } | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "moderator",
    phone: "",
  });

  async function load() {
    const [users, session] = await Promise.all([
      api<UserRow[]>("/api/users"),
      api<{ user: { role: string } }>("/api/auth/me"),
    ]);
    setItems(users);
    setMe(session.user);
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, []);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(form) });
      toast.success("Account created");
      setForm({ name: "", email: "", password: "", role: "moderator", phone: "" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create user");
    }
  }

  async function toggle(user: UserRow) {
    try {
      await api(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((user) =>
      `${user.name} ${user.email} ${user.phone} ${roleLabel[user.role]}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Team" description="Managers can create and disable moderators. Super Admin can manage every role." />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <form onSubmit={createUser} className="space-y-3">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Password">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} />
              <p className="text-xs text-[#5d6f6b]">At least 6 characters</p>
            </Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="moderator">Moderator</option>
                {me?.role === "super_admin" ? <option value="manager">Manager</option> : null}
                {me?.role === "super_admin" ? <option value="super_admin">Super Admin</option> : null}
              </Select>
            </Field>
            <Button>Create account</Button>
          </form>
        </Card>
        <Card className="p-5">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, phone, role"
            className="mb-4"
          />
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-[#5d6f6b]">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} className="border-t border-[#eee4d4]">
                    <td className="px-3 py-3">
                      {user.role === "moderator" ? (
                        <Link href={`/moderators/${user.id}`} className="font-medium hover:underline">
                          {user.name}
                        </Link>
                      ) : (
                        <p className="font-medium">{user.name}</p>
                      )}
                      <p className="text-xs text-[#5d6f6b]">{user.email}</p>
                    </td>
                    <td className="px-3 py-3">{roleLabel[user.role]}</td>
                    <td className="px-3 py-3">{user.isActive ? "Active" : "Disabled"}</td>
                    <td className="px-3 py-3">{formatDate(user.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Button variant="secondary" onClick={() => toggle(user)}>
                        {user.isActive ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={currentPage} pages={pages} total={filtered.length} onPage={setPage} />
        </Card>
      </div>
    </div>
  );
}
