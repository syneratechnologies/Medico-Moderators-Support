"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreateStudentSupport } from "@/components/create-student-support";
import { StudentQueueCard } from "@/components/mobile-cards";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button, Card, Input, Select, TableWrap, TelLink } from "@/components/ui";
import { api } from "@/lib/client";

type Lookups = {
  branches: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  batches: { id: string; name: string }[];
};

type Student = {
  id: string;
  name: string;
  roll: string;
  serial: string;
  studentNumber: string;
  guardianPhone: string;
  branch: { name: string };
  group: { name: string };
  batch: { name: string };
  activeSupports: number;
};

export default function StudentsPage() {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [items, setItems] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [group, setGroup] = useState("");
  const [batch, setBatch] = useState("");
  const [canCreate, setCanCreate] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  async function load() {
    const params = new URLSearchParams({ q, branch, group, batch, limit: "50", page: String(page) });
    const data = await api<{ items: Student[]; total: number; pages: number; page: number }>(`/api/students?${params}`);
    setItems(data.items);
    setTotal(data.total);
    setPages(Math.max(1, data.pages || 1));
  }

  useEffect(() => {
    api<Lookups>("/api/lookups").then(setLookups);
    api<{ user: { role: string } }>("/api/auth/me").then((data) => {
      setCanCreate(data.user.role !== "moderator");
    });
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [q, branch, group, batch, page]);

  async function deleteSelected() {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} student${selected.length > 1 ? "s" : ""} and their supports?`)) return;
    try {
      const result = await api<{ deleted: number; deletedSupports: number }>("/api/students/delete", {
        method: "POST",
        body: JSON.stringify({ studentIds: selected }),
      });
      toast.success(`Deleted ${result.deleted} student${result.deleted > 1 ? "s" : ""}`);
      setSelected([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete students");
    }
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description="Each roll is unique. Supports stay on that same student."
        actions={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!selected.length}
                onClick={() => setCreating(true)}
              >
                New support{selected.length ? ` (${selected.length})` : ""}
              </Button>
              <Link href="/supports">
                <Button variant="secondary">Import students</Button>
              </Link>
            </div>
          ) : null
        }
      />
      <Card className="p-3 md:p-4">
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Name, roll, S-Number, G-Number"
            />
          </div>
          <Select value={branch} onChange={(event) => { setBranch(event.target.value); setPage(1); }}>
            <option value="">All branches</option>
            {lookups?.branches.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
          <Select value={group} onChange={(event) => { setGroup(event.target.value); setPage(1); }}>
            <option value="">All groups</option>
            {lookups?.groups.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
          <Select value={batch} onChange={(event) => { setBatch(event.target.value); setPage(1); }}>
            <option value="">All batches</option>
            {lookups?.batches.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </div>
          {canCreate && selected.length ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f7f1e6] px-3 py-2 text-sm">
            <p>{selected.length} student{selected.length > 1 ? "s" : ""} selected</p>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => setSelected([])}>
                Clear
              </Button>
              <Button type="button" onClick={() => setCreating(true)}>
                New support
              </Button>
              <Button variant="danger" type="button" onClick={deleteSelected}>
                Delete
              </Button>
            </div>
          </div>
        ) : null}
        <div className="space-y-2 md:hidden">
          {items.length ? (
            items.map((student) => (
              <StudentQueueCard
                key={student.id}
                id={student.id}
                name={student.name}
                studentNumber={student.studentNumber}
                guardianPhone={student.guardianPhone}
                placement={`${student.branch.name} · ${student.group.name} · ${student.batch.name}`}
                activeSupports={student.activeSupports}
              />
            ))
          ) : (
            <p className="px-1 py-6 text-sm text-[#5d6f6b]">No students found.</p>
          )}
        </div>
        <div className="hidden md:block">
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-[#5d6f6b]">
              <tr>
                {canCreate ? (
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every((item) => selected.includes(item.id))}
                      onChange={(event) => {
                        setSelected(event.target.checked ? items.map((item) => item.id) : []);
                      }}
                    />
                  </th>
                ) : null}
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">S-Number</th>
                <th className="px-3 py-2">Roll / Serial</th>
                <th className="px-3 py-2">G-Number</th>
                <th className="px-3 py-2">Active supports</th>
                <th className="px-3 py-2">Placement</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((student) => (
                <tr key={student.id} className="border-t border-[#eee4d4]">
                  {canCreate ? (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(student.id)}
                        onChange={() => {
                          setSelected((current) =>
                            current.includes(student.id)
                              ? current.filter((id) => id !== student.id)
                              : [...current, student.id]
                          );
                        }}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-3">
                    <Link href={`/students/${student.id}`} className="font-medium hover:underline">
                      {student.name}
                    </Link>
                    {student.activeSupports > 0 ? (
                      <p className="mt-1 text-xs font-medium text-[#8a5a12]">
                        {student.activeSupports} active support{student.activeSupports > 1 ? "s" : ""}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-[#5d6f6b]">No active support</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{student.studentNumber}</p>
                    <p className="text-xs text-[#5d6f6b]">Student</p>
                  </td>
                  <td className="px-3 py-3">{student.roll} / {student.serial}</td>
                  <td className="px-3 py-3">
                    <TelLink value={student.guardianPhone} />
                    <p className="text-xs text-[#5d6f6b]">Guardian</p>
                  </td>
                  <td className="px-3 py-3">
                    {student.activeSupports > 0 ? (
                      <span className="inline-flex rounded-full bg-[#f8e8c8] px-2.5 py-1 text-xs font-medium text-[#8a5a12]">
                        {student.activeSupports} active
                      </span>
                    ) : (
                      <span className="text-xs text-[#5d6f6b]">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{student.branch.name} · {student.group.name} · {student.batch.name}</td>
                  <td className="px-3 py-3">
                    <Link href={`/students/${student.id}`}>
                      <Button variant="secondary" type="button">View details</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        </div>
        <Pagination page={page} pages={pages} total={total} onPage={setPage} />
      </Card>
      <CreateStudentSupport
        students={items.filter((item) => selected.includes(item.id))}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setSelected([]);
          load().catch(() => {});
        }}
      />
    </div>
  );
}
