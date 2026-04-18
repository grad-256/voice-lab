"use client";

import { Link, routing, usePathname } from "@/i18n/routing";
import { useLocale } from "next-intl";

// フッター配置のロケール切替トグル。
// 現在の pathname を保持したまま、別ロケールの URL に遷移する。
// localePrefix: "as-needed" の効果で、デフォルト（ja）は /echo、英語は /en/echo のようになる。
export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-gray-800 overflow-hidden text-xs"
    >
      {routing.locales.map((l) => {
        const isActive = l === locale;
        return (
          <Link
            key={l}
            href={pathname}
            locale={l}
            aria-current={isActive ? "true" : undefined}
            className={`px-3 py-1 transition-colors ${
              isActive ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-100"
            }`}
          >
            {l.toUpperCase()}
          </Link>
        );
      })}
    </div>
  );
}
