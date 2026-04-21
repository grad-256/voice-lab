// Cloudflare Pages は非静的ルートの全てに Edge Runtime を要求する。
// ルートレイアウトに宣言して root 経由のルートにも確実に行き渡らせる。
export const runtime = "edge";

import { THEME_INIT_SCRIPT } from "@/lib/theme";
import type { Metadata, Viewport } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Fraunces, Inter, Noto_Sans_JP, Shippori_Mincho } from "next/font/google";
import Script from "next/script";
import PostHogProvider from "./components/PostHogProvider";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import "./globals.css";

// 欧文サンセリフ（本文・UI メイン）。
// 以前の Plus Jakarta Sans より骨格が中立で、Fraunces / Shippori Mincho と並んだときの
// 「声の高さ」が揃う。Inter は欧文 UI のデファクトで Latin グリフが安定している。
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// 和文サンセリフ（本文フォールバック）。
// CSS の font-family は文字ごとに flip するため、Inter が欧文を担い、和字だけここに流れる。
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-sans-jp",
  display: "swap",
  weight: ["400", "500", "700"],
});

// Chapter 系譜の見出しに使う欧文セリフ体。
// 以前は italic 軸込みで読み込んでいたが、italic を UI から撤去したため normal のみに縮退。
// 日本語文字は CSS フォールバックで Shippori Mincho に流す。
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600"],
});

// 和文セリフ体（Fraunces との和文ペア）。
// Noto Serif JP は中立的すぎて Fraunces の温度感と噛み合わないため、
// より文学的で筆致の温度が近い Shippori Mincho に置き換えた。
const shipporiMincho = Shippori_Mincho({
  subsets: ["latin"],
  variable: "--font-serif-jp",
  display: "swap",
  weight: ["400", "500", "600"],
});

// ルートの metadata はロケール非依存（icons のみ）。
// title / description はロケールに応じて差し替えたいので generateMetadata で動的に解決し、
// ネスト側（`app/[locale]/layout.tsx`）の generateMetadata にマージ上書きされても問題ないようにする。
export async function generateMetadata(): Promise<Metadata> {
  // middleware が付与するヘッダから現在のロケールを取得。ロケール外ルート（/demo-screenshot 等）は
  // デフォルトロケール（ja）にフォールバックする。
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

// themeColor はメディアクエリでダーク/ライトを切り替え。
// ブラウザの themeColor はカスタム属性を参照できないため、
// 手動選択（localStorage）ではなく OS の prefers-color-scheme のみに追従する。
// 値は globals.css の --bg と揃える（Dark: #121212, Light: #f6f2e9）。
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
    { media: "(prefers-color-scheme: light)", color: "#f6f2e9" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ロケールは middleware が付与するヘッダから取得。
  // 未ロケール経路（/demo-screenshot 等）はデフォルト（ja）にフォールバック。
  const locale = await getLocale();

  return (
    // suppressHydrationWarning：THEME_INIT_SCRIPT が hydration 前に data-theme を書き込むため、
    // サーバー HTML とクライアント DOM で html 要素の属性が差分になる。警告抑止は html 要素 1 段のみに
    // 限定される（子ツリーには波及しない）Next.js / next-themes 標準パターン。
    <html
      lang={locale}
      className={`${inter.variable} ${notoSansJP.variable} ${fraunces.variable} ${shipporiMincho.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[var(--bg)] text-[var(--fg)] antialiased flex flex-col">
        {/* FOUC 防止：React hydration より前に html の data-theme を同期適用する。
            beforeInteractive は root layout でのみ有効（Next.js 15 App Router の制約）。
            スクリプト本体は lib/theme.ts で定義され、localStorage と OS 設定を読む。 */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <PostHogProvider>{children}</PostHogProvider>
        {/* PWA Service Worker 登録（インストール可能判定のため必須） */}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
