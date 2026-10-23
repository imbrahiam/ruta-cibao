import type { ReactNode } from "react";

/** A text page: a headline, a lead, and titled sections. Reads, nothing more. */
export function LegalPage({
  title,
  lead,
  sections,
  children,
}: {
  title: string;
  lead: string;
  sections?: { title: string; body: string }[];
  children?: ReactNode;
}) {
  return (
    <article className="container-page max-w-3xl py-14 md:py-20">
      <h1 className="t-h2">{title}</h1>
      <p className="t-body-lg mt-5 text-ink-2">{lead}</p>
      <div className="mt-12 flex flex-col gap-10">
        {sections?.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="t-h3">{section.title}</h2>
            <p className="t-body-lg text-ink-2">{section.body}</p>
          </section>
        ))}
        {children}
      </div>
    </article>
  );
}
