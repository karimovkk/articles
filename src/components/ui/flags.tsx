import { useId, type SVGProps } from "react";
import type { Locale } from "@/i18n";

/**
 * Til bayroqlari — inline SVG (emoji bayroqlar Windows'da chiqmaydi). 4:3 nisbat, yumaloq burchak.
 */
type FlagProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number };

function Frame({ size = 20, children, ...rest }: FlagProps) {
  const id = "flag-" + useId().replace(/[^a-zA-Z0-9_-]/g, ""); // clip-path url() uchun xavfsiz id
  return (
    <svg width={size} height={(size * 3) / 4} viewBox="0 0 24 18" aria-hidden focusable="false" {...rest}>
      <defs>
        <clipPath id={id}>
          <rect width="24" height="18" rx="3" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>{children}</g>
      <rect width="24" height="18" rx="3" fill="none" stroke="rgba(0,0,0,0.12)" />
    </svg>
  );
}

/** O'zbekiston: ko'k / oq / yashil, qizil hoshiyalar, yarim oy va yulduzlar */
export function FlagUz(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="24" height="6" fill="#1eb5e6" />
      <rect y="6" width="24" height="6" fill="#ffffff" />
      <rect y="12" width="24" height="6" fill="#1eb53a" />
      <rect y="5.7" width="24" height="0.6" fill="#ce1126" />
      <rect y="11.7" width="24" height="0.6" fill="#ce1126" />
      <circle cx="4.2" cy="3" r="2" fill="#ffffff" />
      <circle cx="4.9" cy="3" r="1.7" fill="#1eb5e6" />
      <g fill="#ffffff">
        <circle cx="8.2" cy="1.6" r="0.45" />
        <circle cx="9.9" cy="1.6" r="0.45" />
        <circle cx="11.6" cy="1.6" r="0.45" />
        <circle cx="8.2" cy="3.1" r="0.45" />
        <circle cx="9.9" cy="3.1" r="0.45" />
        <circle cx="11.6" cy="3.1" r="0.45" />
        <circle cx="9.9" cy="4.6" r="0.45" />
        <circle cx="11.6" cy="4.6" r="0.45" />
      </g>
    </Frame>
  );
}

/** Rossiya: oq / ko'k / qizil */
export function FlagRu(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="24" height="6" fill="#ffffff" />
      <rect y="6" width="24" height="6" fill="#0039a6" />
      <rect y="12" width="24" height="6" fill="#d52b1e" />
    </Frame>
  );
}

/** Buyuk Britaniya (Union Jack, soddalashtirilgan) */
export function FlagGb(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="24" height="18" fill="#012169" />
      <path d="M0 0L24 18M24 0L0 18" stroke="#ffffff" strokeWidth="3.2" />
      <path d="M0 0L24 18M24 0L0 18" stroke="#c8102e" strokeWidth="1.2" />
      <path d="M12 0V18M0 9H24" stroke="#ffffff" strokeWidth="5" />
      <path d="M12 0V18M0 9H24" stroke="#c8102e" strokeWidth="2.6" />
    </Frame>
  );
}

const FLAGS: Record<Locale, (p: FlagProps) => React.JSX.Element> = { uz: FlagUz, ru: FlagRu, en: FlagGb };

export function Flag({ locale, ...p }: FlagProps & { locale: Locale }) {
  const C = FLAGS[locale];
  return <C {...p} />;
}
