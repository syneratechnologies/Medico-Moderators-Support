"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[#0b3b38] p-12 text-[#e8f3f0] lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-16 top-24 h-72 w-72 rounded-full bg-[#c9842a]/20 blur-3xl" />
        <div>
          <p className="font-[family-name:var(--font-fraunces)] text-5xl text-white">Medico</p>
          <p className="mt-2 text-sm tracking-[0.22em] uppercase text-[#9ec8c2]">Student support desk</p>
        </div>
        <div className="max-w-md">
          <h1 className="font-[family-name:var(--font-fraunces)] text-4xl leading-tight text-white">
            One student. One profile. A lifetime of support history.
          </h1>
          <p className="mt-4 text-[#c5ddd8]">
            Managers create and assign. Moderators complete with a mandatory outcome. Super Admin sees everything.
          </p>
        </div>
        <p className="text-xs text-[#9ec8c2]">Internal team only · Role-based access</p>
      </section>
      <section
        className="flex min-h-dvh items-center justify-center bg-[#f4efe6] p-5 lg:min-h-0"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-[#ddd4c4] bg-[#fffdf8] p-6 shadow-[var(--shadow)] sm:p-8">
          <div className="mb-6 lg:hidden">
            <p className="font-[family-name:var(--font-fraunces)] text-3xl text-[#0b3b38]">Medico</p>
            <p className="mt-1 text-xs tracking-[0.18em] text-[#5d6f6b] uppercase">Student support desk</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f5c56]">Sign in</p>
          <h2 className="mt-2 font-[family-name:var(--font-fraunces)] text-[1.75rem] md:text-3xl">Welcome back</h2>
          <div className="mt-6 space-y-4">
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" autoComplete="username" />
            <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete="current-password" />
            <Button className="min-h-12 w-full" disabled={loading}>
              {loading ? "Checking…" : "Enter dashboard"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
