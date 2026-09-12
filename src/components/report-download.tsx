import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ReportDownload({
  href,
  compact = false,
  className,
}: {
  href: string;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-2 text-xs font-medium", className)}>
        <a href={`${href}?format=xlsx`} className="text-[#0f5c56] hover:underline">
          Excel
        </a>
        <span className="text-[#c5b8a4]">·</span>
        <a href={`${href}?format=pdf`} className="text-[#0f5c56] hover:underline">
          PDF
        </a>
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <a href={`${href}?format=xlsx`}>
        <Button type="button" variant="secondary">
          Download Excel
        </Button>
      </a>
      <a href={`${href}?format=pdf`}>
        <Button type="button" variant="secondary">
          Download PDF
        </Button>
      </a>
    </div>
  );
}
