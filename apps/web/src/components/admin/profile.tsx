"use client";

import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, orpc } from "@/lib/web/api";
import { FormField } from "./form-field";
import type { Staff } from "./staff-context";

/**
 * The staff member's own profile. An account is appointed from the operator's
 * shell and arrives with a neutral name, so this is where the person says who
 * they are; what they sign in with and their role are shown, not edited.
 */
export function ProfileDialog({
  staff,
  role,
  scope,
  open,
  onOpenChange,
}: {
  staff: Staff;
  role: string;
  scope: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.shell");
  const id = useId();
  const client = useQueryClient();
  const [name, setName] = useState(staff.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = (next: boolean) => {
    if (next) {
      setName(staff.displayName ?? "");
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const displayName = name.trim();
    if (displayName.length < 2 || displayName.length > 80) {
      return setError(t("profileNameInvalid"));
    }
    setSaving(true);
    setError(null);
    try {
      await api.me.updateProfile({
        requestId: crypto.randomUUID(),
        displayName,
        municipalityId: staff.municipalityId,
      });
      await client.invalidateQueries({ queryKey: orpc.me.get.key() });
      onOpenChange(false);
    } catch {
      setError(t("profileFailed"));
    } finally {
      setSaving(false);
    }
  };

  const contact = [staff.email, staff.phoneNumber].filter(Boolean).join(" · ");
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{t("profile")}</DialogTitle>
            <DialogDescription>{t("profileIntro")}</DialogDescription>
          </DialogHeader>
          <FormField
            label={t("profileName")}
            htmlFor={`${id}-name`}
            error={error}
          >
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-name-error` : undefined}
            />
          </FormField>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
            {contact ? (
              <>
                <dt className="text-muted-foreground">{t("profileContact")}</dt>
                <dd className="truncate" title={contact}>
                  {contact}
                </dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">{t("profileRole")}</dt>
            <dd className="truncate">{scope ? `${role} · ${scope}` : role}</dd>
          </dl>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {t(saving ? "profileSaving" : "profileSave")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
