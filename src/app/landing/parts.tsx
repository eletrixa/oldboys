/**
 * Small building blocks shared by the landing sections: photo frame, section heading, section wrapper, CTA pair.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/parts.tsx
 * Deps:    next/image, next/link, ../ui
 * Tested:  n/a (visual; e2e/home.spec.ts covers the landing)
 *
 * Key responsibilities:
 * - Photo: a rounded, outlined frame around a public/marketing image (object-cover, fixed aspect)
 * - Title: serif h2, optionally with a muted second clause ("The CV says a lot. It proves little."); balanced wrapping so no clause ends in a lone word
 * - Section: the shared width, gutter, optional hairline and vertical rhythm of every landing section
 * - Ctas: Create account (primary, same label as the header) + See a sample brief (secondary, jumps to #product);
 *   Log in stays in the header only, so a first-time visitor is never asked to log in twice
 *
 * Design constraints:
 * - Server-safe, semantic tokens only (docs/design/radar-ui.md); photos are AI-generated, never faces
 */
import Image from "next/image";
import Link from "next/link";
import { BTN_PRIMARY, BTN_SECONDARY } from "../ui";

export const PHOTO_SIZE = { width: 1536, height: 1024 } as const;

export function Photo({
  src,
  alt,
  className = "",
  position = "50% 50%",
  priority = false,
}: Readonly<{ src: string; alt: string; className?: string; position?: string; priority?: boolean }>): React.JSX.Element {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-sage/60 shadow-[0_18px_50px_rgba(40,45,43,0.10)] ${className}`}>
      <Image
        src={src}
        alt={alt}
        {...PHOTO_SIZE}
        priority={priority}
        sizes="(min-width: 768px) 50vw, 100vw"
        className="h-full w-full object-cover outline-1 -outline-offset-1 outline-black/10"
        style={{ objectPosition: position }}
      />
    </div>
  );
}

export function Title({ lead, rest, className = "" }: Readonly<{ lead: string; rest?: string; className?: string }>): React.JSX.Element {
  return (
    <h2 className={`font-serif text-[2rem] leading-[1.1] text-balance md:text-[2.75rem] ${className}`}>
      {lead}
      {rest !== undefined && <span className="text-muted"> {rest}</span>}
    </h2>
  );
}

export function Section({
  id,
  children,
  className = "",
  hairline = true,
}: Readonly<{ id?: string; children: React.ReactNode; className?: string; hairline?: boolean }>): React.JSX.Element {
  return (
    <section id={id} className={`mx-auto max-w-5xl scroll-mt-20 px-4 py-16 md:py-24 ${hairline ? "border-t border-divider" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function Ctas({ onDark = false }: Readonly<{ onDark?: boolean }>): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/register" className={BTN_PRIMARY}>
        Create account
      </Link>
      <a
        href="#product"
        className={onDark ? "inline-flex min-h-11 items-center rounded-lg border border-white/60 px-4 text-sm font-medium text-white hover:bg-white/10" : BTN_SECONDARY}
      >
        See a sample brief
      </a>
    </div>
  );
}
