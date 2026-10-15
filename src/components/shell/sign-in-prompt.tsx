import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PhotoPanel } from "./photo-panel";

/**
 * What a signed-out visitor sees on a page that needs an account.
 *
 * The sign-in screen in miniature: the province's photograph with the page's
 * promise over it, then one sentence and one full-width button in the same
 * shape as the sign-in form's. It replaces a grey box with an icon, which made
 * Mi cuenta and Pasaporte feel like a different, unfinished product.
 */
export function SignInPrompt({
  title,
  body,
  action,
  href,
  photo,
  photoTitle,
}: {
  title: string;
  body?: string;
  action: string;
  href: string;
  photo?: string;
  photoTitle: string;
}) {
  return (
    <section className="mt-6 grid gap-5 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-10">
      <PhotoPanel
        src={photo}
        title={photoTitle}
        sizes="(min-width: 768px) 360px, 100vw"
        // Hidden on phones, as on the sign-in screen itself: there the photo
        // is a desktop companion, and on a phone it stacked a third headline
        // between the page title and the one thing to do.
        className="hidden min-h-[26rem] md:flex"
      />
      <div className="flex flex-col gap-5">
        <h2 className="section-title">{title}</h2>
        {body ? (
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            {body}
          </p>
        ) : null}
        <Button
          className="h-12 w-full rounded-[14px] text-base md:w-fit md:px-6"
          nativeButton={false}
          render={<Link href={href} />}
        >
          {action}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
