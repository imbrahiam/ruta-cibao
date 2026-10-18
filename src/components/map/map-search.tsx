"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { CategoryIcon } from "@/components/places/category-icon";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cx } from "@/lib/cx";
import { orpc } from "@/lib/orpc";

export type SearchPick =
  | { kind: "place"; slug: string; name: string; lng: number; lat: number }
  | { kind: "address"; name: string; lng: number; lat: number };

type Recent = SearchPick & { at: number };

const RECENT_KEY = "ruta-cibao:recent-searches";

function readRecent(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Recent[];
  } catch {
    return [];
  }
}

function remember(pick: SearchPick) {
  try {
    const next = [
      { ...pick, at: Date.now() },
      ...readRecent().filter((item) => item.name !== pick.name),
    ].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // A private window has no storage; recent searches are a convenience.
  }
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Search, the way map apps taught everyone: a pill at the top that opens a
 * full-screen search on a phone and a dropdown on a desktop.
 *
 * Places answer as you type, from this platform's own database. Street
 * addresses go to the public geocoder only when asked (the search key, or the
 * "search as an address" row), because its usage policy forbids a request per
 * keystroke and the server rate-limits it app-wide anyway.
 */
export function MapSearch({
  onPick,
  trailing,
  className,
}: {
  onPick: (pick: SearchPick) => void;
  trailing?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("map.search");
  const desktop = useMediaQuery("(min-width: 50.625rem)");
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [addressTerm, setAddressTerm] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const debounced = useDebounced(term.trim(), 220);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const places = useQuery({
    ...orpc.places.search.queryOptions({
      input: { query: debounced, addresses: false },
    }),
    enabled: open && debounced.length >= 2,
    placeholderData: (previous) => previous,
  });
  const addresses = useQuery({
    ...orpc.places.search.queryOptions({
      input: { query: addressTerm ?? "", addresses: true },
    }),
    enabled: addressTerm !== null && addressTerm.length >= 2,
  });

  useEffect(() => {
    if (open) {
      setRecent(readRecent());
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (choice: SearchPick) => {
    remember(choice);
    setOpen(false);
    setTerm("");
    setAddressTerm(null);
    onPick(choice);
  };

  const placeResults = debounced.length >= 2 ? (places.data?.places ?? []) : [];
  const addressResults = addressTerm ? (addresses.data?.addresses ?? []) : [];
  const geocoder = places.data?.geocoder ?? addresses.data?.geocoder ?? true;

  const results = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
      {term.trim().length < 2 ? (
        recent.length > 0 ? (
          <Group title={t("recent")}>
            {recent.map((item) => (
              <Row
                key={`${item.kind}-${item.name}`}
                icon={<Clock strokeWidth={1.5} className="size-4" />}
                title={item.name}
                onClick={() => pick(item)}
              />
            ))}
          </Group>
        ) : (
          <p className="t-small px-4 py-6 text-ink-3">{t("hint")}</p>
        )
      ) : (
        <>
          <Group title={t("places")}>
            {placeResults.length === 0 && !places.isFetching ? (
              <p className="t-small px-3 py-2 text-ink-3">{t("noPlaces")}</p>
            ) : null}
            {placeResults.map((item) => (
              <Row
                key={item.slug}
                icon={
                  <span
                    className="flex size-9 items-center justify-center rounded-full bg-paper-2"
                    style={{ color: item.color }}
                  >
                    <CategoryIcon icon={item.categoryIcon} className="size-4" />
                  </span>
                }
                title={item.name}
                subtitle={`${item.categoryName} · ${item.municipalityName}`}
                onClick={() =>
                  pick({
                    kind: "place",
                    slug: item.slug,
                    name: item.name,
                    lng: item.lng,
                    lat: item.lat,
                  })
                }
              />
            ))}
          </Group>
          {geocoder ? (
            <Group title={t("addresses")}>
              {addressTerm === null || addressTerm !== term.trim() ? (
                <Row
                  icon={<MapPin strokeWidth={1.5} className="size-4" />}
                  title={t("searchAddress", { term: term.trim() })}
                  onClick={() => setAddressTerm(term.trim())}
                />
              ) : addresses.isFetching ? (
                <p className="t-small px-3 py-2 text-ink-3" role="status">
                  {t("searching")}
                </p>
              ) : addressResults.length === 0 ? (
                <p className="t-small px-3 py-2 text-ink-3">
                  {t("noAddresses")}
                </p>
              ) : (
                addressResults.map((item) => (
                  <Row
                    key={`${item.lng},${item.lat}`}
                    icon={<MapPin strokeWidth={1.5} className="size-4" />}
                    title={item.name}
                    subtitle={item.context ?? undefined}
                    onClick={() =>
                      pick({
                        kind: "address",
                        name: item.name,
                        lng: item.lng,
                        lat: item.lat,
                      })
                    }
                  />
                ))
              )}
            </Group>
          ) : null}
        </>
      )}
    </div>
  );

  const field = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const first = placeResults[0];
        if (first)
          pick({
            kind: "place",
            slug: first.slug,
            name: first.name,
            lng: first.lng,
            lat: first.lat,
          });
        else if (term.trim().length >= 2) setAddressTerm(term.trim());
      }}
      className="flex h-12 items-center gap-1 px-1.5"
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={() => setOpen(false)}
        className="press flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-paper-3 md:hidden"
      >
        <ArrowLeft strokeWidth={1.5} className="size-5" />
      </button>
      <Search
        strokeWidth={1.5}
        aria-hidden
        className="ml-2.5 hidden size-[18px] shrink-0 text-ink-3 md:block"
      />
      <input
        ref={input}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-label={t("label")}
        placeholder={t("placeholder")}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-[16px] text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {term ? (
        <button
          type="button"
          aria-label={t("clear")}
          onClick={() => {
            setTerm("");
            setAddressTerm(null);
            input.current?.focus();
          }}
          className="press flex size-10 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-paper-3"
        >
          <X strokeWidth={1.5} className="size-[18px]" />
        </button>
      ) : null}
    </form>
  );

  return (
    <div className={cx("relative", className)}>
      <div className="glass flex h-12 items-center rounded-full pr-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-full pl-4 text-left text-[15px] text-ink-3"
        >
          <Search
            strokeWidth={1.5}
            aria-hidden
            className="size-[18px] shrink-0 text-ink-2"
          />
          <span className="truncate">{t("placeholder")}</span>
        </button>
        {trailing}
      </div>

      {open && desktop ? (
        <div className="absolute inset-x-0 top-0 z-30 flex max-h-[min(560px,calc(100dvh-32px))] flex-col overflow-hidden rounded-panel bg-card shadow-lg animate-panel">
          {field}
          <div className="mx-4 h-px bg-line/70" />
          <div id={listId} className="flex min-h-0 flex-1 flex-col pt-1">
            {results}
          </div>
        </div>
      ) : null}
      {open && desktop ? (
        <button
          type="button"
          aria-label={t("close")}
          tabIndex={-1}
          className="fixed inset-0 z-20 cursor-default"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open && !desktop ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper pt-[max(8px,env(safe-area-inset-top))] animate-fade">
          <div className="mx-3 rounded-full bg-card shadow-ring">{field}</div>
          <div id={listId} className="mt-2 flex min-h-0 flex-1 flex-col">
            {results}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-3">
      <h3 className="t-label px-3 pb-1.5 text-ink-3">{title}</h3>
      <ul>{children}</ul>
    </section>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-12 w-full items-center gap-3 rounded-card px-3 py-2 text-left hover:bg-paper-2 focus-visible:bg-paper-2"
      >
        <span className="flex size-9 shrink-0 items-center justify-center text-ink-3">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[15px] leading-snug text-ink">
            {title}
          </span>
          {subtitle ? (
            <span className="t-small block truncate text-ink-3">
              {subtitle}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
