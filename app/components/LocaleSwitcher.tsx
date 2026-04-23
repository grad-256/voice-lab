"use client";

import { Link, routing, usePathname } from "@/i18n/routing";
import { useLocale } from "next-intl";

// JA / EN 切替トグル。現在の pathname を保持したまま別ロケール URL に遷移。
export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div
      aria-label="Language"
      className="inline-flex items-center border-[0.5px] border-[var(--fg)] overflow-hidden text-[11px] uppercase tracking-[0.14em] font-semibold"
    >
      {routing.locales.map((l) => {
        const isActive = l === locale;
        return (
          <Link
            key={l}
            href={pathname}
            locale={l}
            aria-current={isActive ? "true" : undefined}
            className={`px-2.5 py-2 transition-colors ${
              isActive
                ? "bg-[var(--fg)] text-[var(--bg)]"
                : "text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)]"
            }`}
          >
            {l.toUpperCase()}
          </Link>
        );
      })}
    </div>
  );
}
