import { File, Paths } from "expo-file-system";
import { applyTheme, DEFAULT_THEME, THEMES, type ThemeId } from "@/ui/theme";

/**
 * Which theme the person picked, kept in the app's documents so it survives
 * restarts. `applyTheme` rewrites the live tokens and re-renders everything
 * that reads them through `useTheme`.
 */
const file = new File(Paths.document, "theme.json");

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

/** Reads the saved choice and applies it; call once before the first render. */
export async function loadTheme(): Promise<void> {
  let id: ThemeId = DEFAULT_THEME;
  try {
    if (file.exists) {
      const saved = JSON.parse(await file.text())?.theme;
      if (isThemeId(saved)) id = saved;
    }
  } catch {
    // An unreadable file falls back to the default theme.
  }
  applyTheme(id);
}

export function setTheme(id: ThemeId): void {
  applyTheme(id);
  try {
    file.write(JSON.stringify({ theme: id }));
  } catch {
    // Not persisted; the switch still applies for this session.
  }
}
