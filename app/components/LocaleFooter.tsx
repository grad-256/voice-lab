"use client";

// Footer の出し分け：
//   - 表示する：LP (`/`) / 404
//     → 法務ドキュメント (`/terms`・`/privacy`) は Notion 公開ページに外出し済みのため
//       ここにはルートそのものが存在しない（lib/legalUrls.ts 参照）
//   - 非表示：アプリ領域 (`/app`・`/diary`・`/me` とその配下)・`/reset-password`
//     → PWA / TWA 起動時はアプリ内ミニマム運用。法務・SNS 等の導線は /me のリンク島で代替。
//       `/reset-password` はメールリンク経由の専用フォームで、AuthGate もバイパスされる
//       「アプリ的フロー」の一部なので footer を出さない（lib/auth/protectedPaths.ts も参照）。
//
// pathname 判定は next-intl の `usePathname`（ロケールプリフィックスを除いた正規化パスが返る）
// を使う。Issue #75 / LP サービス分離の一環。

import { NoteIcon } from "@/app/components/icons/note-icon";
import { XIcon } from "@/app/components/icons/x-icon";
import { Link, usePathname } from "@/i18n/routing";
import { LEGAL_URLS } from "@/lib/legalUrls";
import { useTranslations } from "next-intl";

export function LocaleFooter() {
  const pathname = usePathname();
  const t = useTranslations("footer");

  // アプリ領域はブラックリスト方式で除外。LP / 法務 / 404 / その他の新設ページには自動で出る。
  const isAppArea =
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/diary" ||
    pathname.startsWith("/diary/") ||
    pathname === "/me" ||
    pathname.startsWith("/me/") ||
    pathname === "/reset-password";

  if (isAppArea) return null;

  return (
    <footer className="border-t border-[var(--border)] py-8 px-6 text-center">
      {/* SaaS サーフェスの内部リンク（Pricing / FAQ / Release notes）。
          既存の逆三角形 2 段（法務 + SNS）とは独立した行として上段に置く。
          P3 #105 で追加。 */}
      <div className="mb-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm tracking-wide text-[var(--fg-subtle)]">
        <Link href="/pricing" className="hover:text-[var(--fg)] transition-colors">
          {t("pricing")}
        </Link>
        <Link href="/faq" className="hover:text-[var(--fg)] transition-colors">
          {t("faq")}
        </Link>
        <Link href="/release-notes" className="hover:text-[var(--fg)] transition-colors">
          {t("releaseNotes")}
        </Link>
      </div>

      {/* モバイル: 上段（note / X）と下段（利用規約 / プライバシー）の 2 段で逆三角形に並べる。
          デスクトップ（sm 以上）は sm:contents でラッパーを透過し、従来どおり 1 段で並べる。 */}
      <div className="flex flex-col items-center gap-3 text-sm tracking-wide text-[var(--fg-subtle)] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-3">
        <div className="order-2 flex items-center gap-x-8 sm:order-1 sm:contents">
          {/* 法務リンクは Notion 公開ページに外出し（PWA でも確実に外部ブラウザで開く）。
              内部ページ `/terms`・`/privacy` は持たず Notion のみで運用（lib/legalUrls.ts 参照）。 */}
          <a
            href={LEGAL_URLS.terms}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--fg)] transition-colors"
          >
            {t("terms")}
          </a>
          <a
            href={LEGAL_URLS.privacy}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--fg)] transition-colors"
          >
            {t("privacy")}
          </a>
        </div>
        <span className="hidden text-[var(--border-strong)] sm:order-2 sm:inline">|</span>
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
            href="https://x.com/myvoicelab"
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
  );
}
