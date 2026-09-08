"use client";

import { useTranslations } from "next-intl";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

type Municipality = { id: string; name: string };

/**
 * Picking a municipality, from a list of three.
 *
 * A single native select on every screen: the OS picker on a phone (where the
 * thumb already is) and a familiar dropdown on desktop. It carries the form
 * field name itself, so the Server Action sees the value with no hidden input
 * and no JavaScript required.
 */
export function MunicipalityPicker({
  municipalities,
  name = "municipalityId",
}: {
  municipalities: Municipality[];
  name?: string;
}) {
  const t = useTranslations("onboarding.cedula");

  return (
    <NativeSelect
      id={name}
      name={name}
      size="lg"
      className="w-full"
      defaultValue=""
      required
    >
      <NativeSelectOption value="">
        {t("municipalityPlaceholder")}
      </NativeSelectOption>
      {municipalities.map((municipality) => (
        <NativeSelectOption key={municipality.id} value={municipality.id}>
          {municipality.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
