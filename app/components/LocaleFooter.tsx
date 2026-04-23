"use client";

// LP / 404 / その他非アプリ領域の footer。法務リンク（Notion JA/EN）+ SNS。

import { NoteIcon } from "@/app/components/icons/note-icon";
import { XIcon } from "@/app/components/icons/x-icon";
import { usePathname } from "@/i18n/routing";
import { getLegalUrls } from "@/lib/legalUrls";
import { useLocale, useTranslations } from "next-intl";

export function LocaleFooter() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("footer");

  // アプリ領域ではフッター非表示。
  const isAppArea =
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/diary" ||
    pathname.startsWith("/diary/") ||
    pathname === "/me" ||
    pathname.startsWith("/me/") ||
    pathname === "/reset-password";

  if (isAppArea) return null;

  const legal = getLegalUrls(locale);

  return (
    <footer className="border-t border-[var(--border)] py-8 px-6 text-center">
      <div className="flex flex-col items-center gap-3 text-sm tracking-wide text-[var(--fg-subtle)] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-3">
        <div className="order-2 flex items-center gap-x-8 sm:order-1 sm:contents">
          <a
            href={legal.terms}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--fg)] transition-colors"
          >
            {t("terms")}
          </a>
          <a
            href={legal.privacy}
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
        </div>
      </div>
    </footer>
  );
}
