// 404 ページ。Cloudflare Pages の Edge Runtime 要件を満たすために明示。
// [locale] 配下では app/[locale]/not-found.tsx が優先表示される。
// このファイルは [locale] に乗らないレアなルート（middleware 除外対象の 404 等）で表示される。
export const runtime = "edge";

import { routing } from "@/i18n/routing";
import { getLocale, getTranslations } from "next-intl/server";

export default async function NotFound() {
  // i18n/request.ts 側でロケール不正時は defaultLocale にフォールバック済み
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });
  // localePrefix: "as-needed" の挙動に合わせる。defaultLocale は "/"、他ロケールは "/{locale}"
  const homeHref = locale === routing.defaultLocale ? "/" : `/${locale}`;

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 text-center animate-fadeIn">
      <h1 className="text-2xl font-semibold text-[var(--fg)] mb-3 leading-relaxed">{t("title")}</h1>
      <p className="text-sm text-[var(--fg-muted)] mb-10 leading-relaxed">{t("description")}</p>
      <a
        href={homeHref}
        className="inline-block border border-[var(--border-strong)] hover:border-[var(--accent)] text-[var(--fg)] hover:text-[var(--accent-strong)] px-6 py-3 rounded-md text-sm transition-colors"
      >
        {t("backHome")}
      </a>
    </main>
  );
}
