// Cloudflare Pages は非静的ルートの全てに Edge Runtime を要求するため、
// layout レベルで宣言して以下のページ全てに継承させる。
export const runtime = "edge";

import LocaleSwitcher from "@/app/components/LocaleSwitcher";
import { NoteIcon } from "@/app/components/icons/note-icon";
import { XIcon } from "@/app/components/icons/x-icon";
import { Link, routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// ロケールごとに metadata を切り替える。ルート layout の静的 metadata より優先される。
export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // 静的レンダリング有効化。以降の next-intl フックより先に呼ぶ必要がある。
  setRequestLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations("footer");

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <div className="flex-1 flex flex-col">{children}</div>
      <footer className="border-t border-gray-800 py-5 px-6 text-center">
        {/* モバイル: 上段（note / X / JA-EN）と下段（利用規約 / プライバシー）の 2 段で逆三角形に並べる。
            デスクトップ（sm 以上）は sm:contents でラッパーを透過し、従来どおり 1 段で並べる。 */}
        <div className="flex flex-col items-center gap-3 text-sm text-gray-400 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-3">
          {/* モバイル下段 / デスクトップ左側 */}
          <div className="order-2 flex items-center gap-x-6 sm:order-1 sm:contents">
            <Link href="/terms" className="hover:text-gray-400 transition-colors">
              {t("terms")}
            </Link>
            <Link href="/privacy" className="hover:text-gray-400 transition-colors">
              {t("privacy")}
            </Link>
          </div>
          {/* デスクトップのみの縦セパレーター */}
          <span className="hidden text-gray-800 sm:order-2 sm:inline">|</span>
          {/* モバイル上段 / デスクトップ右側 */}
          <div className="order-1 flex items-center gap-x-6 sm:order-3 sm:contents">
            <a
              href="https://note.com/uclab/m/m59dc828ffd47"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("noteAriaLabel")}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <NoteIcon className="h-4 w-auto" />
            </a>
            <a
              href="https://x.com/UCLab1421"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("xAriaLabel")}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <XIcon className="h-4 w-auto" />
            </a>
            <LocaleSwitcher />
          </div>
        </div>
      </footer>
    </NextIntlClientProvider>
  );
}

// 備考：Edge Runtime と generateStaticParams は併用不可のため、SSG はしない。
// Cloudflare Pages の Edge 側で毎リクエスト動的に描画する（キャッシュはエッジ側で効く）。
