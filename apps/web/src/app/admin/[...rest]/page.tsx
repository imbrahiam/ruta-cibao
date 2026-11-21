import { notFound } from "next/navigation";

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

/** Any /admin path that is not a desk page: the 404 keeps the shell around it. */
export default function AdminUnknownPage() {
  notFound();
}
