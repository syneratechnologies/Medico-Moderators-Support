"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Field, PasswordInput } from "@/components/ui";
import { api } from "@/lib/client";

export function ChangePassword({
  userId,
  compact,
}: {
  userId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (password.trim().length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      });
      toast.success("Password updated");
      setPassword("");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change password");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant={compact ? "ghost" : "secondary"} onClick={() => setOpen(true)}>
        Change password
      </Button>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "flex flex-wrap items-end gap-2"}>
      <Field label="New password">
        <PasswordInput
          value={password}
          minLength={6}
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
          }}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="button" disabled={saving} onClick={save}>
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={() => {
            setOpen(false);
            setPassword("");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
