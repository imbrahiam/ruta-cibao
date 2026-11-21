import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminPageMetadata } from "@/app/admin/page-metadata";
import { QueueDesk } from "@/components/admin/queue/queue-desk";
import { isQueueSlug, QUEUE_SLUGS } from "@/components/admin/queue/slugs";

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ queue: string }>;
}): Promise<Metadata> {
  const { queue } = await params;
  return adminPageMetadata(`/admin/queue/${queue}`);
}

export function generateStaticParams() {
  return QUEUE_SLUGS.map((queue) => ({ queue }));
}

export default async function AdminQueuePage({
  params,
}: {
  params: Promise<{ queue: string }>;
}) {
  const { queue } = await params;
  if (!isQueueSlug(queue)) notFound();
  return <QueueDesk queue={queue} />;
}
