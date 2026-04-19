// Cloudflare Pages は非静的ルートの全てに Edge Runtime を要求する。
// ルートレイアウトに宣言して root 経由のルートにも確実に行き渡らせる。
export const runtime = "edge";

import type { Metadata, Viewport } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Noto_Sans_JP, Noto_Serif_JP, Plus_Jakarta_Sans } from "next/font/google";
import PostHogProvider from "./components/PostHogProvider";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto",
  display: "swap",
  weight: ["400", "500", "700"],
});

// Quiet Journal の見出しに使うセリフ体。
// globals.css の `.font-serif-jp` ユーティリティと `--font-serif` を繋ぐ。
const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "600"],
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

export const viewport: Viewport = {
  themeColor: "#ffffff",
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
    <html
      lang={locale}
      className={`${jakartaSans.variable} ${notoSansJP.variable} ${notoSerifJP.variable}`}
    >
      <body className="min-h-screen bg-[var(--bg)] text-[var(--fg)] antialiased flex flex-col">
        <PostHogProvider>{children}</PostHogProvider>
        {/* PWA Service Worker 登録（インストール可能判定のため必須） */}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
