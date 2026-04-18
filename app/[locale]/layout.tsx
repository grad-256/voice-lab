// Cloudflare Pages は非静的ルートの全てに Edge Runtime を要求するため、
// layout レベルで宣言して以下のページ全てに継承させる。
export const runtime = "edge";

import LocaleSwitcher from "@/app/components/LocaleSwitcher";
import { NoteIcon } from "@/app/components/icons/note-icon";
import { XIcon } from "@/app/components/icons/x-icon";
import { Link, routing } from "@/i18n/routing";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

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
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-gray-400">
          <Link href="/terms" className="hover:text-gray-400 transition-colors">
            {t("terms")}
          </Link>
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">
            {t("privacy")}
          </Link>
          <span className="hidden sm:inline text-gray-800">|</span>
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
      </footer>
    </NextIntlClientProvider>
  );
}

// 備考：Edge Runtime と generateStaticParams は併用不可のため、SSG はしない。
// Cloudflare Pages の Edge 側で毎リクエスト動的に描画する（キャッシュはエッジ側で効く）。
