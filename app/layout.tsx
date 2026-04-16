import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Plus_Jakarta_Sans } from "next/font/google";
import PostHogProvider from "./components/PostHogProvider";
import { AuthMigrationListener } from "./components/auth/AuthMigrationListener";
import { NoteIcon } from "./components/icons/note-icon";
import { XIcon } from "./components/icons/x-icon";
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
    <html lang="ja" className={`${jakartaSans.variable} ${notoSansJP.variable}`}>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased flex flex-col">
        <PostHogProvider>
          <div className="flex-1 flex flex-col">{children}</div>
          <footer className="border-t border-gray-800 py-5 px-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-gray-400">
              <a href="/terms" className="hover:text-gray-400 transition-colors">
                利用規約
              </a>
              <a href="/privacy" className="hover:text-gray-400 transition-colors">
                プライバシーポリシー
              </a>
              <span className="hidden sm:inline text-gray-800">|</span>
              <a
                href="https://note.com/uclab/m/m59dc828ffd47"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="note の MyVoiceLab マガジン"
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <NoteIcon className="h-4 w-auto" />
              </a>
              <a
                href="https://x.com/UCLab1421"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (旧 Twitter) の UCLab アカウント"
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <XIcon className="h-4 w-auto" />
              </a>
            </div>
          </footer>
        </PostHogProvider>
        {/* ゲスト → 認証ユーザー移行のトリガ。UI は通常レンダーされない（移行成功時のみトースト表示） */}
        <AuthMigrationListener />
      </body>
    </html>
  );
}
