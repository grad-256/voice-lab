import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "VoiceLab — AI 英会話パートナー",
  description: "声で話しかけると AI が音声で返してくれる英会話練習アプリ",
  // PWA: ホーム画面に追加したときのアイコン・タイトル（iOS）
  appleWebApp: {
    capable: true,
    title: "VoiceLab",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
