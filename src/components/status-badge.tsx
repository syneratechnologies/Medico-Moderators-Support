import { statusLabel } from "@/lib/client";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  pending: "bg-[#f8e8c8] text-[#8a5a12]",
  in_progress: "bg-[#d9e7f7] text-[#21527a]",
  completed: "bg-[#d8eee6] text-[#0f5c56]",
  cancelled: "bg-[#ece7de] text-[#6b6358]",
  high: "bg-[#f8d9d6] text-[#8f2f2b]",
  medium: "bg-[#f8e8c8] text-[#8a5a12]",
  low: "bg-[#e7eee9] text-[#3f5b54]",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize", tones[value] ?? tones.pending)}>
      {statusLabel[value] ?? value}
    </span>
  );
}
