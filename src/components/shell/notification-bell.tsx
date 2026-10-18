"use client";

import { Popover } from "@base-ui/react/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-context";
import { useRealtime } from "@/hooks/use-realtime";
import { useRouter } from "@/i18n/navigation";
import { renderNotification } from "@/i18n/open-keys";
import { cx } from "@/lib/cx";
import { orpc } from "@/lib/orpc";

/**
 * The notification centre: a bell with an unread count, and a list that marks
 * itself read as it is opened. Live through the person's own realtime channel,
 * so an answer from the ayuntamiento arrives without a reload.
 */
export function NotificationBell({ className }: { className?: string }) {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return null;
  return <Bell_ className={className} />;
}

function Bell_({ className }: { className?: string }) {
  const t = useTranslations("notifications");
  const tRoot = useTranslations();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery(
    orpc.notifications.list.queryOptions({ input: { limit: 20 } }),
  );
  const listKey = orpc.notifications.list.key();

  useRealtime({
    channels: [],
    onEvent: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const markRead = useMutation(
    orpc.notifications.markRead.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
    }),
  );

  const unread = query.data?.unread ?? 0;
  const items = query.data?.items ?? [];

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={
          unread > 0 ? t("openWithCount", { count: unread }) : t("open")
        }
        className={cx(
          "press relative flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-paper-3 hover:text-ink pointer-coarse:size-11",
          className,
        )}
      >
        <Bell strokeWidth={1.5} className="size-[19px]" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] leading-none text-on-accent tabular ring-2 ring-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup className="flex max-h-[min(560px,calc(100dvh-96px))] w-[min(380px,calc(100vw-24px))] origin-[var(--transform-origin)] flex-col overflow-hidden rounded-panel bg-card text-ink shadow-lg outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:scale-[.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[.98] data-[starting-style]:opacity-0">
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
              <Popover.Title className="text-[17px] font-medium tracking-[-0.012em]">
                {t("title")}
              </Popover.Title>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={() => markRead.mutate({})}
                  className="press rounded-full px-2.5 py-1 text-[14px] text-accent hover:bg-accent-soft"
                >
                  {t("markAllRead")}
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <BellOff strokeWidth={1.5} className="size-5 text-ink-3" />
                  <p className="mt-3 text-[15px] font-medium">{t("empty")}</p>
                  <p className="t-small mt-1 text-ink-2">{t("emptyHint")}</p>
                </div>
              ) : (
                <ul className="flex flex-col">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!item.readAt) markRead.mutate({ id: item.id });
                          if (item.href) router.push(item.href as "/mapa");
                        }}
                        className="flex w-full items-start gap-3 rounded-card px-3 py-3 text-left hover:bg-paper-2"
                      >
                        <span
                          aria-hidden
                          className={cx(
                            "mt-2 size-2 shrink-0 rounded-full",
                            item.readAt ? "bg-transparent" : "bg-accent",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cx(
                              "block text-[15px] leading-snug",
                              item.readAt ? "text-ink-2" : "text-ink",
                            )}
                          >
                            {renderNotification(
                              tRoot,
                              item.messageKey,
                              item.params,
                            )}
                          </span>
                          <span className="t-small mt-1 block text-ink-3">
                            {format.relativeTime(new Date(item.createdAt), now)}
                            {item.readAt ? null : (
                              <span className="sr-only">, {t("unread")}</span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
