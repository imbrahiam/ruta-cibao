"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { PathPicker } from "@/components/map/path-picker";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { Link } from "@/i18n/navigation";
import { client, orpc } from "@/lib/orpc";
import { uuid } from "@/lib/uuid";

/**
 * Opening a case with the ayuntamiento.
 *
 * The cédula gate is explained rather than enforced silently, and the
 * explanation is the honest one: a case is addressed to an office that answers
 * to residents, so the office has to know it is talking to one. A visitor sees
 * why, and a way to become one — not a disabled button.
 *
 * There is no offline queue behind this form, unlike the traffic report. A case
 * is a considered piece of writing rather than something typed at the roadside;
 * queueing it would mean somebody sends four hundred words and finds out a day
 * later that the category no longer exists.
 */
export function OpenConsultationDrawer({
  municipalityName,
  open,
  onOpenChange,
}: {
  municipalityName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("consultations.form");
  const routesT = useTranslations("routes");
  const [locations, setLocations] = useState<{ lng: number; lat: number }[]>(
    [],
  );
  const [requestId, setRequestId] = useState(() => uuid());
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const signInHref = useSignInHref();
  const queryClient = useQueryClient();
  const { viewer, isLoading } = useAuth();

  const { data: categories = [] } = useQuery(
    orpc.consultations.categories.queryOptions(),
  );
  const [categoryId, setCategoryId] = useState("");

  const submit = useMutation({
    mutationFn: (input: { title: string; body: string }) =>
      client.consultations.open({
        requestId,
        categoryId,
        location: locations[0],
        ...input,
      }),
    onSuccess: async () => {
      toast.success(t("sent"));
      setCategoryId("");
      setLocations([]);
      setRequestId(uuid());
      await queryClient.invalidateQueries({
        queryKey: orpc.consultations.browse.key(),
      });
      onOpenChange(false);
    },
    onError: () => toast.error(t("failed")),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit.mutate({
      title: String(form.get("title") ?? ""),
      body: String(form.get("body") ?? ""),
    });
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <DrawerContent>
        <DrawerHeader className="border-b">
          <div className="flex items-start gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessagesSquare className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <DrawerTitle className="text-lg">{t("title")}</DrawerTitle>
              <DrawerDescription className="text-pretty leading-relaxed">
                {t("description", { municipality: municipalityName ?? "" })}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {isLoading ? (
            <p
              className="flex min-h-32 items-center justify-center gap-2 text-muted-foreground text-sm"
              role="status"
            >
              <Spinner className="size-4" />
            </p>
          ) : viewer?.kind === "anonymous" ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/40 p-6 text-center">
              <MessagesSquare
                className="size-7 text-muted-foreground"
                aria-hidden
              />
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("signInHint")}
              </p>
              <Button
                className="h-11 w-full"
                nativeButton={false}
                render={<Link href={signInHref} />}
              >
                {t("signIn")}
              </Button>
            </div>
          ) : viewer?.kind !== "citizen" ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/40 p-6 text-center">
              <ShieldCheck
                className="size-7 text-muted-foreground"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="font-medium">{t("needsCedula")}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("needsCedulaHint")}
                </p>
              </div>
              <Button
                className="h-11 w-full"
                nativeButton={false}
                render={<Link href="/verificar" />}
              >
                {t("verify")}
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="case-title">{t("subject")}</Label>
                <Input
                  id="case-title"
                  name="title"
                  className="h-11"
                  placeholder={t("subjectPlaceholder")}
                  minLength={8}
                  maxLength={120}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="case-category">{t("category")}</Label>
                <NativeSelect
                  id="case-category"
                  size="lg"
                  className="w-full"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  required
                >
                  <NativeSelectOption value="">
                    {t("categoryPlaceholder")}
                  </NativeSelectOption>
                  {categories.map((category) => (
                    <NativeSelectOption key={category.id} value={category.id}>
                      {category.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label htmlFor="case-body">{t("body")}</Label>
                <Textarea
                  id="case-body"
                  name="body"
                  rows={6}
                  placeholder={t("bodyPlaceholder")}
                  minLength={40}
                  maxLength={2000}
                  required
                />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t("bodyHint")}
                </p>
              </div>

              <details className="rounded-xl border p-3">
                <summary className="cursor-pointer py-2 text-sm font-medium">
                  {routesT("caseLocation")}
                </summary>
                <PathPicker points={locations} onChange={setLocations} single />
              </details>
              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={submit.isPending || !categoryId}
              >
                {submit.isPending ? (
                  <Spinner className="size-5" />
                ) : (
                  <MessagesSquare className="size-5" aria-hidden />
                )}
                {submit.isPending ? t("sending") : t("submit")}
              </Button>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
