// Cloudflare Pages は非静的ルートの全てに Edge Runtime を要求するため、
// layout レベルで宣言して以下のページ全てに継承させる。
export const runtime = "edge";

import { LocaleShellThemeLock } from "@/app/components/LocaleShellThemeLock";
// 英語版のプライバシーポリシー・利用規約が未整備のため、一時的に言語切替 UI を無効化。
// EN 版 legal docs を追加するタイミングで import と footer 内の呼び出しを復活させる。
// import LocaleSwitcher from "@/app/components/LocaleSwitcher";
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
      {/* LP ルート時のみ children + footer の subtree を `data-theme="dark"` に固定する。
          これにより、html が `data-theme="light"` でも LP ページ本体と直下 footer が一体でダーク表示になり、
          LP 下端で紙色 footer に切り替わる視覚的破断を防ぐ。非 LP 時は data-theme 属性を付けない。 */}
      {/* LocaleShellThemeLock が flex-1 flex flex-col を兼ねる。
          注：初回表示のフェードインはページ単位（各ページ最上位要素）に付ける方針。
          ここでラップすると opacity <1 が stacking context を作り、配下の z-index モーダルや
          トースト等の重なり順序が一時的に崩れる懸念があるため、レイアウト側では付けない。 */}
      <LocaleShellThemeLock>
        {children}
        <footer className="border-t border-[var(--border)] py-8 px-6 text-center">
          {/* モバイル: 上段（note / X / JA-EN）と下段（利用規約 / プライバシー）の 2 段で逆三角形に並べる。
            デスクトップ（sm 以上）は sm:contents でラッパーを透過し、従来どおり 1 段で並べる。 */}
          <div className="flex flex-col items-center gap-3 text-sm tracking-wide text-[var(--fg-subtle)] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-3">
            {/* モバイル下段 / デスクトップ左側 */}
            <div className="order-2 flex items-center gap-x-8 sm:order-1 sm:contents">
              <Link href="/terms" className="hover:text-[var(--fg)] transition-colors">
                {t("terms")}
              </Link>
              <Link href="/privacy" className="hover:text-[var(--fg)] transition-colors">
                {t("privacy")}
              </Link>
            </div>
            {/* デスクトップのみの縦セパレーター */}
            <span className="hidden text-[var(--border-strong)] sm:order-2 sm:inline">|</span>
            {/* モバイル上段 / デスクトップ右側 */}
            <div className="order-1 flex items-center gap-x-8 sm:order-3 sm:contents">
              <a
                href="https://note.com/uclab/m/m59dc828ffd47"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("noteAriaLabel")}
                className="text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
              >
                <NoteIcon className="h-4 w-auto" />
              </a>
              <a
                href="https://x.com/UCLab1421"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("xAriaLabel")}
                className="text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
              >
                <XIcon className="h-4 w-auto" />
              </a>
              {/* 英語版 legal docs 未整備のため一時無効化。EN 版公開と同時に復活させる。 */}
              {/* <LocaleSwitcher /> */}
            </div>
          </div>
        </footer>
      </LocaleShellThemeLock>
    </NextIntlClientProvider>
  );
}

// 備考：Edge Runtime と generateStaticParams は併用不可のため、SSG はしない。
// Cloudflare Pages の Edge 側で毎リクエスト動的に描画する（キャッシュはエッジ側で効く）。
