import { appTargetHref } from "@ruta/shared/app-target";
import { directionsUrl } from "@ruta/shared/directions";
import { Clock, MapPin, Mountain, Navigation, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { QrCode } from "@/components/landing/qr-code";
import { buttonStyles } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { cx } from "@/lib/web/cx";
import { getFormatter, getT } from "@/lib/web/i18n";
import { pathPoints } from "@/lib/web/path-preview";
import type { ShareContent } from "@/lib/web/share";
import { APP_SCHEME, site } from "@/lib/web/site";

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

/**
 * A shared link, read-only: what it points at, and a way into the app.
 * No account, no map, no form: the full experience lives in the app.
 */
export function ShareView({ content }: { content: ShareContent }) {
  const t = getT("share");
  const canonical = `${site.origin}${appTargetHref({ kind: content.kind, ref: content.ref })}`;

  return (
    <div className="container-page grid gap-8 py-10 md:grid-cols-[minmax(0,1fr)_280px] md:py-16">
      <article className="flex min-w-0 flex-col gap-6">
        <p className="t-label text-accent">{t(content.kind)}</p>
        {content.kind === "place" ? <PlaceBody content={content} /> : null}
        {content.kind === "route" ? <RouteBody content={content} /> : null}
        {content.kind === "consultation" ? (
          <ConsultationBody content={content} />
        ) : null}
        {content.kind === "traffic" ? <TrafficBody content={content} /> : null}
      </article>

      <aside className="flex flex-col gap-4 md:sticky md:top-24 md:self-start">
        <div className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-ring">
          <a
            href={appLink(content.kind, content.ref)}
            className={buttonStyles({
              variant: "accent",
              size: "lg",
              block: true,
            })}
          >
            {t("open")}
          </a>
          <Link
            href="/download"
            className={buttonStyles({
              variant: "secondary",
              size: "lg",
              block: true,
            })}
          >
            {t("download")}
          </Link>
        </div>
        <div className="hidden flex-col items-center gap-3 rounded-card bg-card p-5 shadow-ring md:flex">
          <QrCode value={canonical} label={t("universal")} />
          <p className="t-small text-center text-ink-3">{t("universal")}</p>
        </div>
      </aside>
    </div>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <ul className="flex flex-wrap items-center gap-2">{children}</ul>;
}

function Fact({
  icon: Icon,
  children,
}: {
  icon: typeof MapPin;
  children: ReactNode;
}) {
  return (
    <li className="inline-flex items-center gap-2 rounded-full bg-paper-2 px-3.5 py-1.5 text-[14px] text-ink-2">
      <Icon aria-hidden className="size-4" />
      {children}
    </li>
  );
}

function PlaceBody({
  content,
}: {
  content: Extract<ShareContent, { kind: "place" }>;
}) {
  const place = getT("place");
  const { data } = content;
  const photo = data.photos[0] ?? data.imageUrl;

  return (
    <>
      {photo ? (
        // Signed or first-party URL from the API; its size is not known here.
        // biome-ignore lint/performance/noImgElement: dynamic API image URL
        <img
          src={photo}
          alt={data.name}
          className="aspect-[16/10] w-full rounded-panel bg-paper-3 object-cover"
        />
      ) : null}
      <h1 className="t-h2">{data.name}</h1>
      <Facts>
        <Fact icon={MapPin}>{data.municipality.name}</Fact>
        <li>
          <Tag tone="accent">{data.category.name}</Tag>
        </li>
        <li>
          <Tag>{place(`trust.${data.trust.state}`)}</Tag>
        </li>
      </Facts>
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
      <a
        href={directionsUrl(
          { lat: data.location.lat, lng: data.location.lng, label: data.name },
          "other",
        )}
        rel="noopener"
        className={cx(buttonStyles({ variant: "secondary" }), "self-start")}
      >
        <Navigation aria-hidden />
        {place("directions")}
      </a>
    </>
  );
}

function RouteBody({
  content,
}: {
  content: Extract<ShareContent, { kind: "route" }>;
}) {
  const t = getT("share");
  const routes = getT("routes");
  const format = getFormatter();
  const { data } = content;
  const preview = pathPoints(data.path, 640, 360);
  const km = format.number(data.distanceMeters / 1000, {
    maximumFractionDigits: 1,
  });

  return (
    <>
      <h1 className="t-h2">{data.name}</h1>
      <Facts>
        <Fact icon={MapPin}>{data.municipalityName}</Fact>
        <Fact icon={Mountain}>{t(data.difficulty)}</Fact>
        <Fact icon={Clock}>
          {t("duration", { minutes: data.durationMinutes })}
        </Fact>
        <Fact icon={Navigation}>{t("distance", { distance: km })}</Fact>
      </Facts>
      {preview ? (
        <svg
          viewBox="0 0 640 360"
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
      ) : null}
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
    </>
  );
}

function ConsultationBody({
  content,
}: {
  content: Extract<ShareContent, { kind: "consultation" }>;
}) {
  const t = getT("share");
  const consultations = getT("consultations");
  const format = getFormatter();
  const { data } = content;

  return (
    <>
      <h1 className="t-h2">{data.title}</h1>
      <Facts>
        <Fact icon={MapPin}>{data.municipalityName}</Fact>
        <li>
          <Tag tone={STATUS_TONE[data.status] ?? "neutral"}>
            {consultations(`statusLabel.${data.status}`)}
          </Tag>
        </li>
        <li>
          <Tag tone="accent">{data.categoryName}</Tag>
        </li>
        <Fact icon={Users}>
          {consultations("supports", { count: data.supportCount })}
        </Fact>
      </Facts>
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
    </>
  );
}

function TrafficBody({
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
    <>
      <h1 className="t-h2">{data.categoryName}</h1>
      <Facts>
        <Fact icon={MapPin}>{data.municipalityName}</Fact>
        {data.severity ? (
          <li>
            <Tag tone={cleared ? "success" : "warning"}>
              {cleared
                ? traffic("cleared")
                : traffic(`severity.${data.severity}`)}
            </Tag>
          </li>
        ) : null}
        {cleared ? null : (
          <Fact icon={Clock}>
            {t("validUntil", {
              date: format.dateTime(new Date(data.expiresAt), {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              }),
            })}
          </Fact>
        )}
      </Facts>
      <p className="t-body-lg text-ink-2">{t("trafficNotice")}</p>
    </>
  );
}
