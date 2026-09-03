"use client";

import { Check, ChevronDown, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Municipality = { id: string; name: string };

/**
 * Picking a municipality, from a list of three.
 *
 * On a phone this is a drawer rather than a dropdown: it opens from the bottom
 * where the thumb already is, each option is a full-width row instead of a
 * cramped popup line, and it can be dismissed by swiping down — the gesture
 * people already use everywhere else on the device.
 *
 * On a wider screen a dropdown is the familiar thing, so that is what appears.
 * Both write to one hidden input, so the Server Action sees a single value
 * regardless of which control was used, and a `<noscript>` fallback keeps the
 * form submittable when JavaScript has not loaded.
 */
export function MunicipalityPicker({
  municipalities,
  name = "municipalityId",
}: {
  municipalities: Municipality[];
  name?: string;
}) {
  const t = useTranslations("onboarding.cedula");
  const [selected, setSelected] = useState<Municipality | null>(null);
  const [open, setOpen] = useState(false);

  function choose(municipality: Municipality) {
    setSelected(municipality);
    setOpen(false);
  }

  return (
    <>
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      {/* Phone: a bottom drawer. */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-between text-base font-normal md:hidden"
            >
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
                <span className={selected ? "" : "text-muted-foreground"}>
                  {selected?.name ?? t("municipalityPlaceholder")}
                </span>
              </span>
              <ChevronDown
                className="size-4 text-muted-foreground"
                aria-hidden
              />
            </Button>
          }
        />

        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t("municipality")}</DrawerTitle>
            <DrawerDescription>{t("municipalityHelp")}</DrawerDescription>
          </DrawerHeader>

          <ul className="flex flex-col gap-1 px-4 pb-8">
            {municipalities.map((municipality) => {
              const isSelected = selected?.id === municipality.id;
              return (
                <li key={municipality.id}>
                  <button
                    type="button"
                    onClick={() => choose(municipality)}
                    aria-pressed={isSelected}
                    // Full-width, 56px tall: a one-handed target, not a menu line.
                    className="flex h-14 w-full items-center justify-between rounded-lg px-4 text-left text-base transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {municipality.name}
                    {isSelected && <Check className="size-5" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </DrawerContent>
      </Drawer>

      {/* Wider screens: the familiar dropdown. */}
      <div className="hidden md:block">
        <Select
          value={selected?.id ?? ""}
          onValueChange={(id) =>
            setSelected(municipalities.find((m) => m.id === id) ?? null)
          }
        >
          <SelectTrigger className="h-12 w-full text-base">
            <SelectValue placeholder={t("municipalityPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {municipalities.map((municipality) => (
              <SelectItem
                key={municipality.id}
                value={municipality.id}
                className="h-11 text-base"
              >
                {municipality.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Neither control exists before hydration; a plain select always does. */}
      <noscript>
        <select
          name={name}
          required
          className="h-12 w-full rounded-md border bg-background px-3 text-base"
        >
          <option value="">{t("municipalityPlaceholder")}</option>
          {municipalities.map((municipality) => (
            <option key={municipality.id} value={municipality.id}>
              {municipality.name}
            </option>
          ))}
        </select>
      </noscript>
    </>
  );
}
