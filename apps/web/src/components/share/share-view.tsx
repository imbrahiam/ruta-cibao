import { appTargetHref } from "@ruta/shared/app-target";
import { BRAND_COLORS } from "@ruta/shared/brand";
import { directionsUrl } from "@ruta/shared/directions";
import { Check, CircleAlert, MapPin, Navigation } from "lucide-react";
import type { ReactNode } from "react";
import { CategoryPin } from "@/components/category/category-pin";
import { QrCode } from "@/components/landing/qr-code";
import { buttonStyles } from "@/components/site/button";
import { Tag } from "@/components/site/tag";
import { cx } from "@/lib/web/cx";
import { getFormatter, getT } from "@/lib/web/i18n";
import { pathPoints } from "@/lib/web/path-preview";
import type { ShareContent } from "@/lib/web/share";
import { APP_SCHEME, site } from "@/lib/web/site";
import { CopyLink } from "./copy-link";
import { ShareRow } from "./share-row";
import { TrustBadge } from "./trust-badge";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const STATUS_TONE: Record<string, Tone> = {
  open: "neutral",
  in_review: "warning",
  answered: "accent",
  resolved: "success",
  rejected: "danger",
};

/** The in-app link for a target; the scheme the native app registers. */
function appLink(kind: ShareContent["kind"], ref: string): string {
  return `${APP_SCHEME}:/${appTargetHref({ kind, ref })}`;
}

/** The main action beside the title: directions, when there is somewhere to go. */
type Primary = { href: string; label: string };

/**
 * A shared link, read-only: what it points at, how to get there, and a way
 * into the app. No account, no map, no form: the full experience lives in the
 * app. One column unless there is a photo or a route drawing worth a second.
 */
export function ShareView({ content }: { content: ShareContent }) {
  switch (content.kind) {
    case "place":
      return <PlaceSheet content={content} />;
    case "route":
      return <RouteSheet content={content} />;
    case "consultation":
      return <ConsultationSheet content={content} />;
    case "traffic":
      return <TrafficSheet content={content} />;
  }
}

function Sheet({
  content,
  title,
  meta,
  metaIcon,
  badge,
  status,
  primary,
  media,
  children,
}: {
  content: ShareContent;
  title: string;
  /** Short facts, read as one line: "Monción · Comedor". */
  meta: string[];
  /** What leads the facts line; a place shows its category's map pin. */
  metaIcon?: ReactNode;
  /** Sits beside the facts on a wide screen, under them on a phone. */
  badge?: ReactNode;
  status?: ReactNode;
  primary?: Primary;
  media?: ReactNode;
  children?: ReactNode;
}) {
  const t = getT("share");
  const canonical = `${site.origin}${appTargetHref({ kind: content.kind, ref: content.ref })}`;

  return (
    <div className="container-page py-10 md:py-16">
      <div
        className={cx(
          "grid gap-8",
          media
            ? "md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-start md:gap-12"
            : "max-w-2xl",
        )}
      >
        <article className="flex min-w-0 flex-col">
          <h1 className="t-h2 font-[family-name:var(--font-fraunces)] text-balance">
            {title}
          </h1>
          <div className="mt-3 flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-4">
            <p className="t-body flex items-center gap-2 text-ink-2">
              {metaIcon ?? <MapPin aria-hidden className="size-4 shrink-0" />}
              <span>{meta.join(" · ")}</span>
            </p>
            {badge}
          </div>
          {status ? <div className="mt-2">{status}</div> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {primary ? (
              <a
                href={primary.href}
                rel="noopener"
                className={buttonStyles({ variant: "brand", size: "lg" })}
              >
                <Navigation aria-hidden />
                {primary.label}
              </a>
            ) : null}
            <a
              href={appLink(content.kind, content.ref)}
              className={buttonStyles({
                variant: primary ? "secondary" : "brand",
                size: "lg",
              })}
            >
              {t("open")}
            </a>
          </div>

          {children ? (
            <div className="mt-10 flex flex-col gap-6">{children}</div>
          ) : null}

          <TakeAlong content={content} canonical={canonical} />
        </article>

        {/* Before the title on a phone, beside it on a wider screen. */}
        {media ? <div className="-order-1 md:order-none">{media}</div> : null}
      </div>
    </div>
  );
}

/**
 * Handing the link to a phone. On a desktop the code sits in view, forest green
 * straight on the page's ivory with a clear margin; on a phone, where scanning
 * your own screen makes no sense, copying is the shortcut and the code waits
 * behind "Compartir" for someone else's camera.
 */
function TakeAlong({
  content,
  canonical,
}: {
  content: ShareContent;
  canonical: string;
}) {
  const t = getT("share");
  const code = (size: number) => (
    <QrCode
      value={canonical}
      label={t(`scan.${content.kind}`)}
      size={size}
      color={BRAND_COLORS.pine}
      background={BRAND_COLORS.paper}
      margin={4}
    />
  );

  return (
    <section
      aria-labelledby="take-along"
      className="mt-12 flex items-center gap-4"
    >
      <div className="-ml-3 hidden shrink-0 md:block">{code(128)}</div>
      <div className="flex min-w-0 flex-col items-start">
        <h2 id="take-along" className="text-[16px] font-medium max-md:sr-only">
          {t("takeAlong")}
        </h2>
        <p className="t-small mt-0.5 text-ink-2 max-md:hidden">
          {t(`scan.${content.kind}`)}
        </p>
        <div className="mt-1">
          <ShareRow
            label={t("share")}
            copy={
              <CopyLink
                value={canonical}
                labels={{
                  copy: t("copyLink"),
                  copied: t("linkCopied"),
                  failed: t("copyFailed"),
                }}
              />
            }
            panel={
              <div className="flex flex-col items-start gap-1">
                <div className="-ml-3">{code(168)}</div>
                <p className="t-small text-ink-2">
                  {t(`scan.${content.kind}`)}
                </p>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

/** A quiet status line: icon and words, never colour alone. */
function StatusLine({
  icon: Icon,
  children,
}: {
  icon: typeof Check;
  children: ReactNode;
}) {
  return (
    <p className="t-small inline-flex items-center gap-1.5 text-ink-2">
      <Icon aria-hidden className="size-4" />
      {children}
    </p>
  );
}

function PlaceSheet({
  content,
}: {
  content: Extract<ShareContent, { kind: "place" }>;
}) {
  const place = getT("place");
  const { data } = content;
  const photo = data.photos[0] ?? data.imageUrl;
  const trust = data.trust.state;
  const t = getT("share");

  return (
    <Sheet
      content={content}
      title={data.name}
      meta={[data.municipality.name, data.category.name]}
      metaIcon={
        <CategoryPin icon={data.category.icon} color={data.category.color} />
      }
      badge={
        trust === "confirmed" ? (
          <TrustBadge
            label={place("trust.confirmed")}
            detail={t("confirmedDetail", {
              count: data.trust.confirmations,
            })}
          />
        ) : null
      }
      // Doubt and age still say so, quietly, under the facts.
      status={
        trust === "doubted" || trust === "established" ? (
          <StatusLine icon={trust === "doubted" ? CircleAlert : Check}>
            {place(`trust.${trust}`)}
          </StatusLine>
        ) : null
      }
      primary={{
        href: directionsUrl(
          { lat: data.location.lat, lng: data.location.lng, label: data.name },
          "other",
        ),
        label: place("directions"),
      }}
      media={
        photo ? (
          // Signed or first-party URL from the API; its size is not known here.
          // biome-ignore lint/performance/noImgElement: dynamic API image URL
          <img
            src={photo}
            alt={data.name}
            className="aspect-[4/3] w-full rounded-panel bg-paper-3 object-cover"
          />
        ) : null
      }
    >
      {data.description || data.address ? (
        <>
          {data.description ? (
            <p className="t-body-lg whitespace-pre-line text-ink-2">
              {data.description}
            </p>
          ) : null}
          {data.address ? (
            <p className="t-body text-ink-2">
              <span className="font-medium text-ink">{place("address")}: </span>
              {data.address}
            </p>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

function RouteSheet({
  content,
}: {
  content: Extract<ShareContent, { kind: "route" }>;
}) {
  const t = getT("share");
  const routes = getT("routes");
  const place = getT("place");
  const format = getFormatter();
  const { data } = content;
  const preview = pathPoints(data.path, 640, 480, 72);
  const start = data.path[0];
  const km = format.number(data.distanceMeters / 1000, {
    maximumFractionDigits: 1,
  });

  return (
    <Sheet
      content={content}
      title={data.name}
      meta={[
        data.municipalityName,
        t(data.difficulty),
        t("duration", { minutes: data.durationMinutes }),
        t("distance", { distance: km }),
      ]}
      // Directions go to the trailhead: the walk itself is the app's job.
      primary={
        start
          ? {
              href: directionsUrl(
                { lat: start.lat, lng: start.lng, label: data.name },
                "other",
              ),
              label: place("directions"),
            }
          : undefined
      }
      media={
        preview ? (
          <svg
            viewBox="0 0 640 480"
            role="img"
            aria-label={`${data.name}: ${t("distance", { distance: km })}`}
            className="w-full rounded-panel bg-paper-2"
          >
            <polyline
              points={preview.points}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={preview.start[0]}
              cy={preview.start[1]}
              r={8}
              fill="var(--card)"
              stroke="var(--accent)"
              strokeWidth={4}
            />
            <circle
              cx={preview.end[0]}
              cy={preview.end[1]}
              r={8}
              fill="var(--accent)"
            />
          </svg>
        ) : null
      }
    >
      <p className="t-body-lg whitespace-pre-line text-ink-2">
        {data.description}
      </p>
      {data.services.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="t-h3">{routes("services")}</h2>
          <ul className="flex flex-wrap gap-2">
            {data.services.map((service) => (
              <li key={service}>
                <Tag>{routes(`service.${service}`)}</Tag>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="flex flex-col gap-1.5 rounded-card bg-paper-2 p-5">
        <h2 className="text-[16px] font-medium">{routes("safetyTitle")}</h2>
        <p className="t-body text-ink-2">{routes("safetyBody")}</p>
      </section>
    </Sheet>
  );
}

function ConsultationSheet({
  content,
}: {
  content: Extract<ShareContent, { kind: "consultation" }>;
}) {
  const t = getT("share");
  const consultations = getT("consultations");
  const format = getFormatter();
  const { data } = content;

  return (
    <Sheet
      content={content}
      title={data.title}
      meta={[
        data.municipalityName,
        t("consultation"),
        data.categoryName,
        consultations("supports", { count: data.supportCount }),
      ]}
      status={
        <Tag tone={STATUS_TONE[data.status] ?? "neutral"}>
          {consultations(`statusLabel.${data.status}`)}
        </Tag>
      }
    >
      <section className="flex flex-col gap-4">
        <h2 className="t-h3">{t("responses")}</h2>
        {data.responses.length === 0 ? (
          <p className="t-body text-ink-2">{consultations("noResponses")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {data.responses.map((response) => (
              <li
                key={response.id}
                className="flex flex-col gap-2 rounded-card bg-card p-5 shadow-ring"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={STATUS_TONE[response.statusAfter] ?? "neutral"}>
                    {consultations(`statusLabel.${response.statusAfter}`)}
                  </Tag>
                  <time
                    dateTime={response.createdAt}
                    className="t-small text-ink-3"
                  >
                    {format.dateTime(new Date(response.createdAt), "long")}
                  </time>
                </div>
                <p className="t-body whitespace-pre-line">{response.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Sheet>
  );
}

function TrafficSheet({
  content,
}: {
  content: Extract<ShareContent, { kind: "traffic" }>;
}) {
  const t = getT("share");
  const traffic = getT("traffic");
  const format = getFormatter();
  const { data } = content;
  const cleared = data.state === "cleared";

  return (
    <Sheet
      content={content}
      title={data.categoryName}
      meta={[
        data.municipalityName,
        t("traffic"),
        ...(cleared
          ? []
          : [
              t("validUntil", {
                date: format.dateTime(new Date(data.expiresAt), {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                }),
              }),
            ]),
      ]}
      status={
        cleared ? (
          <Tag tone="success">{traffic("cleared")}</Tag>
        ) : data.severity ? (
          <Tag tone="warning">{traffic(`severity.${data.severity}`)}</Tag>
        ) : null
      }
    >
      <p className="t-body-lg text-ink-2">{t("trafficNotice")}</p>
    </Sheet>
  );
}
