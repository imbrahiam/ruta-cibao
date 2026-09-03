"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, CheckCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { useRealtime } from "@/hooks/use-realtime";
import { Link } from "@/i18n/navigation";
import { withOpenKeys } from "@/i18n/open-keys";
import { orpc } from "@/lib/orpc";

/**
 * The notification centre.
 *
 * Rows render from a catalogue key and its parameters, never from stored text,
 * so a notification written months ago still reads correctly and in whatever
 * language the reader has chosen.
 *
 * While the first load is in flight this shows a line of text with a spinner
 * rather than grey placeholder rows. A list that is usually short or empty
 * would make a skeleton lie about how much is coming.
 */
export function NotificationList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const queryClient = useQueryClient();

  const query = useQuery(
    orpc.notifications.list.queryOptions({ input: { limit: 20 } }),
  );

  // The user channel is granted from the session, so this needs no id.
  useRealtime({ channels: [], onEvent: () => queryClient.invalidateQueries() });

  const markRead = useMutation(
    orpc.notifications.markRead.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(),
    }),
  );

  if (query.isPending) {
    return (
      <p
        className="flex items-center gap-2 px-4 py-6 text-muted-foreground text-sm"
        role="status"
        aria-live="polite"
      >
        <Spinner className="size-4" /> {t("loading")}
      </p>
    );
  }

  const items = query.data?.items ?? [];

  if (items.length === 0) {
    return (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellOff />
          </EmptyMedia>
          <EmptyTitle>{t("empty")}</EmptyTitle>
          <EmptyDescription>{t("emptyHint")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {(query.data?.unread ?? 0) > 0 && (
        <div className="px-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-start"
            onClick={() => markRead.mutate({})}
            disabled={markRead.isPending}
          >
            {markRead.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <CheckCheck className="size-4" aria-hidden />
            )}
            {t("markAllRead")}
          </Button>
        </div>
      )}

      <ItemGroup className="px-2 pb-6">
        {items.map((item) => {
          const row = (
            <Item
              key={item.id}
              variant={item.readAt ? "default" : "muted"}
              // 64px minimum: read one-handed, often outdoors.
              className="min-h-16 items-start gap-3 rounded-lg"
            >
              {!item.readAt && (
                <>
                  {/* The dot is decoration; the state itself is text, so a
                      screen reader hears "Sin leer" rather than nothing. */}
                  <span className="sr-only">{t("unread")}</span>
                  <span
                    aria-hidden
                    className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                  />
                </>
              )}
              <ItemContent>
                <ItemTitle className="whitespace-normal text-sm leading-snug">
                  {withOpenKeys(t)(item.messageKey, item.params)}
                </ItemTitle>
                <ItemDescription className="text-xs">
                  {format.dateTime(new Date(item.createdAt), "short")}
                </ItemDescription>
              </ItemContent>
            </Item>
          );

          return item.href ? (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => {
                markRead.mutate({ id: item.id });
                onNavigate?.();
              }}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {row}
            </Link>
          ) : (
            row
          );
        })}
      </ItemGroup>
    </div>
  );
}
