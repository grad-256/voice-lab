// Cloudflare Pages は非静的ルートの全てに Edge Runtime を要求するため、
// layout レベルで宣言して以下のページ全てに継承させる。
export const runtime = "edge";

import { LocaleFooter } from "@/app/components/LocaleFooter";
import { LocaleShellThemeLock } from "@/app/components/LocaleShellThemeLock";
import { AuthProvider } from "@/app/components/auth/AuthContext";
// 英語版のプライバシーポリシー・利用規約が未整備のため、一時的に言語切替 UI を無効化。
// EN 版 legal docs を追加するタイミングで import と footer 内の呼び出しを復活させる。
// import LocaleSwitcher from "@/app/components/LocaleSwitcher";
import { AuthDialog } from "@/app/components/auth/AuthDialog";
import { AuthGate } from "@/app/components/auth/AuthGate";
import { routing } from "@/i18n/routing";
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

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      {/* AuthProvider は locale shell の外側（Client 境界の内側）に置き、
          配下すべてのクライアントコンポーネントから useAuth() で参照できるようにする。
          AuthGate は副作用だけを持つヘッドレスコンポーネント、AuthDialog は z-60 のモーダル本体。 */}
      <AuthProvider>
        {/* LP ルート時のみ children + footer の subtree を `data-theme="dark"` に固定する。
          これにより、html が `data-theme="light"` でも LP ページ本体と直下 footer が一体でダーク表示になり、
          LP 下端で紙色 footer に切り替わる視覚的破断を防ぐ。非 LP 時は data-theme 属性を付けない。 */}
        {/* LocaleShellThemeLock が flex-1 flex flex-col を兼ねる。
          注：初回表示のフェードインはページ単位（各ページ最上位要素）に付ける方針。
          ここでラップすると opacity <1 が stacking context を作り、配下の z-index モーダルや
          トースト等の重なり順序が一時的に崩れる懸念があるため、レイアウト側では付けない。 */}
        <LocaleShellThemeLock>
          {children}
          {/* LocaleFooter はアプリ領域（/app・/diary・/me 配下）では null を返す。
              表示判定とマークアップは LocaleFooter 側に集約する。 */}
          <LocaleFooter />
        </LocaleShellThemeLock>
        <AuthGate />
        <AuthDialog />
      </AuthProvider>
    </NextIntlClientProvider>
  );
}

// 備考：Edge Runtime と generateStaticParams は併用不可のため、SSG はしない。
// Cloudflare Pages の Edge 側で毎リクエスト動的に描画する（キャッシュはエッジ側で効く）。
