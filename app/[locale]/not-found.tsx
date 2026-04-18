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
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-white mb-3">{t("title")}</h1>
      <p className="text-sm text-gray-400 mb-8">{t("description")}</p>
      <Link
        href="/"
        className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
      >
        {t("backHome")}
      </Link>
    </main>
  );
}
