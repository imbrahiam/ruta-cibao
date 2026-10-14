import { MapPin } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A photograph of the province with a line set over its foot.
 *
 * The sign-in screen's panel, shared so every place that asks someone to sign
 * in looks like the sign-in screen itself — the owner's benchmark for how an
 * internal page should feel.
 */
export function PhotoPanel({
  src = "/places/parque-sabaneta.webp",
  title,
  body,
  className,
  sizes = "550px",
  priority = false,
}: {
  src?: string;
  title: string;
  body?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <aside
      className={cn(
        "relative flex overflow-hidden rounded-[2rem] bg-primary",
        className,
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
        priority={priority}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#102d24]/95 via-[#102d24]/35 to-black/5" />
      <div className="relative mt-auto p-7 text-white md:p-10">
        <MapPin className="mb-5 size-7 md:mb-6 md:size-8" aria-hidden />
        <h2 className="text-balance font-display font-medium text-3xl leading-tight md:text-4xl">
          {title}
        </h2>
        {body ? (
          <p className="mt-3 max-w-sm text-sm text-white/80 leading-relaxed md:mt-4">
            {body}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
