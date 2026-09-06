"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/client";
import { StatusBadge } from "./status-badge";

type SearchResult = {
  students: Array<{
    id: string;
    name: string;
    studentNumber: string;
    roll: string;
    branch: { name: string };
  }>;
  supports: Array<{
    id: string;
    status: string;
    description: string;
    supportType: { name: string };
    student: { name?: string; studentNumber?: string };
  }>;
};

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult>({ students: [], supports: [] });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!q.trim()) {
        setResult({ students: [], supports: [] });
        return;
      }
      api<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`).then(setResult).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 bg-[#17302c]/40 md:p-4" onClick={onClose}>
      <div
        className="flex h-full flex-col bg-[#fffdf8] md:mx-auto md:mt-16 md:h-auto md:max-h-[80vh] md:max-w-2xl md:rounded-3xl md:border md:border-[#ddd4c4] md:p-4 md:shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#eee4d4] px-3 py-2 md:border-0 md:p-0">
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name, roll, S-Number, phone, support…"
            className="min-h-11 w-full rounded-2xl border border-[#ddd4c4] px-4 text-base outline-none md:py-3"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#5d6f6b]"
            aria-label="Close search"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-4 md:mt-4 md:max-h-[60vh] md:p-0">
          {result.students.length > 0 && (
            <section>
              <p className="mb-2 text-xs uppercase tracking-wide text-[#5d6f6b]">Students</p>
              {result.students.map((student) => (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  onClick={onClose}
                  className="mb-2 block min-h-14 rounded-2xl bg-[#f7f1e6] px-4 py-3 active:bg-[#efe7d8]"
                >
                  <p className="font-medium">{student.name}</p>
                  <p className="text-xs text-[#5d6f6b]">
                    S-Number {student.studentNumber} · Roll {student.roll} · {student.branch.name}
                  </p>
                </Link>
              ))}
            </section>
          )}
          {result.supports.length > 0 && (
            <section>
              <p className="mb-2 text-xs uppercase tracking-wide text-[#5d6f6b]">Supports</p>
              {result.supports.map((support) => (
                <Link
                  key={support.id}
                  href={`/supports/${support.id}`}
                  onClick={onClose}
                  className="mb-2 flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-[#f7f1e6] px-4 py-3 active:bg-[#efe7d8]"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{support.supportType.name}</p>
                    <p className="truncate text-xs text-[#5d6f6b]">
                      {support.student.name} · S-Number {support.student.studentNumber}
                    </p>
                  </div>
                  <StatusBadge value={support.status} />
                </Link>
              ))}
            </section>
          )}
          {q.trim() && !result.students.length && !result.supports.length ? (
            <p className="px-1 py-8 text-center text-sm text-[#5d6f6b]">No matches</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
