import { notFound } from "next/navigation";

/** Any /admin path that is not a desk page: the 404 keeps the shell around it. */
export default function AdminUnknownPage() {
  notFound();
}
