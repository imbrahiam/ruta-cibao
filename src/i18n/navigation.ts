import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for the Next.js navigation primitives. Use these
 * rather than `next/link` and `next/navigation` so links keep working the day a
 * second language is added.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
