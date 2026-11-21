"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  type AdminThemePreference,
  useAdminTheme,
} from "@/lib/web/admin-theme";

const CHOICES = [
  { value: "system", icon: Monitor, label: "themeSystem" },
  { value: "light", icon: Sun, label: "themeLight" },
  { value: "dark", icon: Moon, label: "themeDark" },
] as const;

/**
 * The desk's appearance inside the account menu: follow the device, or keep
 * it light or dark. Remembered on this browser; applied before paint on the
 * next visit (see `ADMIN_THEME_SCRIPT`).
 */
export function ThemeChoices() {
  const t = useTranslations("admin.shell");
  const { preference, setPreference } = useAdminTheme();
  return (
    <>
      <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={preference}
        onValueChange={(next) => setPreference(next as AdminThemePreference)}
      >
        {CHOICES.map(({ value, icon: Icon, label }) => (
          <DropdownMenuRadioItem
            key={value}
            value={value}
            // Choosing keeps the menu open, so the change can be seen and undone.
            onSelect={(event) => event.preventDefault()}
          >
            <Icon aria-hidden="true" />
            {t(label)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
