import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "MyVoiceLab — AI 英会話パートナー",
  description: "声で話しかけると AI が音声で返してくれる英会話練習アプリ",
  // PWA: ホーム画面に追加したときのアイコン・タイトル（iOS）
  appleWebApp: {
    capable: true,
    title: "MyVoiceLab",
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
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased flex flex-col">
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <footer className="border-t border-gray-800 py-4 px-6 text-center">
          <div className="flex justify-center gap-6 text-xs text-gray-600">
            <a href="/terms" className="hover:text-gray-400 transition-colors">利用規約</a>
            <a href="/privacy" className="hover:text-gray-400 transition-colors">プライバシーポリシー</a>
          </div>
        </footer>
        <SwRegister />
      </body>
    </html>
  );
}
