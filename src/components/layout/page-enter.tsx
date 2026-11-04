import type { ReactNode } from "react";

/**
 * 123: route group'larning `template.tsx` i — layout (menyu, sidebar) saqlanadi, template esa har sahifa almashishida
 * qayta yaratiladi: kontent silliq paydo bo'ladi (`.page-enter`; `prefers-reduced-motion` da — yo'q).
 */
export default function PageEnter({ children }: { children: ReactNode }) {
  return (
    <div className="page-enter" data-testid="page-enter">
      {children}
    </div>
  );
}
