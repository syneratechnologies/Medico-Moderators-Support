import { cn, isValidPhone, normalizePhone } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-3xl border border-[#ddd4c4] bg-[#fffdf8] shadow-[var(--shadow)]", className)}>
      {children}
    </div>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-[#0f5c56] text-white hover:bg-[#0b3b38]",
    secondary: "bg-white text-[#17302c] border border-[#ddd4c4] hover:bg-[#f7f1e6]",
    ghost: "bg-transparent text-[#17302c] hover:bg-[#efe7d8]",
    danger: "bg-[#b24a45] text-white hover:bg-[#933933]",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition disabled:opacity-50",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-11 w-full rounded-2xl border border-[#ddd4c4] bg-white px-3.5 py-2.5 text-base outline-none ring-[#0f5c56]/20 focus:ring-4 md:text-sm",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "min-h-11 w-full rounded-2xl border border-[#ddd4c4] bg-white px-3.5 py-2.5 text-base outline-none ring-[#0f5c56]/20 focus:ring-4 md:text-sm",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-2xl border border-[#ddd4c4] bg-white px-3.5 py-2.5 text-base outline-none ring-[#0f5c56]/20 focus:ring-4 md:text-sm",
        props.className
      )}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#5d6f6b]">{label}</span>
      {children}
    </label>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function TelLink({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const display = value?.trim() || "—";
  const tel = value ? normalizePhone(value) : "";
  if (!tel || !isValidPhone(value ?? "")) {
    return <span className={className}>{display}</span>;
  }
  return (
    <a
      href={`tel:${tel}`}
      className={cn("font-medium text-[#0f5c56] underline-offset-2 hover:underline", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {display}
    </a>
  );
}
