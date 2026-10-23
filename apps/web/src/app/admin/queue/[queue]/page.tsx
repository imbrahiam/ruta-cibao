import { notFound } from "next/navigation";
import { QueueDesk } from "@/components/admin/queue/queue-desk";
import { isQueueSlug, QUEUE_SLUGS } from "@/components/admin/queue/slugs";

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
