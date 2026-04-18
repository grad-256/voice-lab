// Cloudflare Pages は非静的ルートの全てに Edge Runtime を要求する。
// ルートレイアウトに宣言して root 経由のルートにも確実に行き渡らせる。
export const runtime = "edge";

import type { Metadata, Viewport } from "next";
import { getLocale } from "next-intl/server";
import { Noto_Sans_JP, Plus_Jakarta_Sans } from "next/font/google";
import PostHogProvider from "./components/PostHogProvider";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { AuthMigrationListener } from "./components/auth/AuthMigrationListener";
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

export const metadata: Metadata = {
  title: "MyVoiceLab — AI と声で話して、残す",
  description:
    "AI と様々なシチュエーションで話し、話した内容を可視化する。声で生活する、新しいかたち。",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

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
    <html lang={locale} className={`${jakartaSans.variable} ${notoSansJP.variable}`}>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased flex flex-col">
        <PostHogProvider>{children}</PostHogProvider>
        {/* ゲスト → 認証ユーザー移行のトリガ。UI は通常レンダーされない（移行成功時のみトースト表示） */}
        <AuthMigrationListener />
        {/* PWA Service Worker 登録（インストール可能判定のため必須） */}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
