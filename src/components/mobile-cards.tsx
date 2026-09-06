import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDateTime } from "@/lib/utils";

export function SupportQueueCard({
  id,
  studentName,
  studentNumber,
  supportType,
  status,
  priority,
  when,
}: {
  id: string;
  studentName?: string;
  studentNumber?: string;
  supportType: string;
  status: string;
  priority?: string;
  when?: string | null;
}) {
  return (
    <Link
      href={`/supports/${id}`}
      className="block rounded-2xl border border-[#eee4d4] bg-white px-4 py-3.5 active:bg-[#f7f1e6]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-snug">{studentName || "Student"}</p>
          <p className="mt-0.5 truncate text-sm text-[#5d6f6b]">
            {studentNumber ? `${studentNumber} · ` : ""}
            {supportType}
          </p>
          {when ? <p className="mt-1 text-xs text-[#5d6f6b]">{formatDateTime(when)}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge value={status} />
          {priority ? <span className="text-xs capitalize text-[#5d6f6b]">{priority}</span> : null}
        </div>
      </div>
    </Link>
  );
}

export function StudentQueueCard({
  id,
  name,
  studentNumber,
  guardianPhone,
  placement,
  activeSupports,
}: {
  id: string;
  name: string;
  studentNumber: string;
  guardianPhone: string;
  placement: string;
  activeSupports: number;
}) {
  return (
    <Link
      href={`/students/${id}`}
      className="block rounded-2xl border border-[#eee4d4] bg-white px-4 py-3.5 active:bg-[#f7f1e6]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-snug">{name}</p>
          <p className="mt-0.5 text-sm text-[#5d6f6b]">S-Number {studentNumber}</p>
          <p className="mt-0.5 text-sm text-[#5d6f6b]">G-Number {guardianPhone}</p>
          <p className="mt-1 truncate text-xs text-[#5d6f6b]">{placement}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            activeSupports > 0 ? "bg-[#f8e8c8] text-[#8a5a12]" : "bg-[#e7eee9] text-[#3f5b54]"
          )}
        >
          {activeSupports > 0 ? `${activeSupports} active` : "Clear"}
        </span>
      </div>
    </Link>
  );
}
