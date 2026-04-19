// ロケール配下の 404 ページ。Server Component として実装することで、
// SSR → hydrate のチラつきを避け、Edge Runtime との整合も取る。
// 親 `app/[locale]/layout.tsx` が `setRequestLocale` を先に呼んでいるので、
// getLocale / getTranslations はそのロケールを解決する。
export const runtime = "edge";

import { Link } from "@/i18n/routing";
import { getLocale, getTranslations } from "next-intl/server";

export default async function LocaleNotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 text-center animate-fadeIn">
      <h1 className="text-2xl font-semibold text-[var(--fg)] mb-3 leading-relaxed">{t("title")}</h1>
      <p className="text-sm text-[var(--fg-muted)] mb-10 leading-relaxed">{t("description")}</p>
      <Link
        href="/"
        className="inline-block border border-[var(--border-strong)] hover:border-[var(--accent)] text-[var(--fg)] hover:text-[var(--accent-strong)] px-6 py-3 rounded-md text-sm transition-colors"
      >
        {t("backHome")}
      </Link>
    </main>
  );
}
