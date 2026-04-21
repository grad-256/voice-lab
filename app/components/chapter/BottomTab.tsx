"use client";

// Chapter 系譜の下部タブバー。Home / Record / Archive / Me の 4 タブ。
// アクティブタブはセリフ italic + 大きめ、非アクティブは sans 小さめで「章の手がかり」の階層を作る。
// 未対応パスでは active を渡さないことで全タブが非アクティブ表示になる（LP など）。

import { Link, usePathname } from "@/i18n/routing";

type TabKey = "home" | "record" | "archive" | "me";

type TabItem = {
  key: TabKey;
  label: string;
  /** 日本語の副ラベル（読み仮名のような小さな文字） */
  jp: string;
  href: string;
  /** アクティブ判定に使う path のプレフィックス。最も長いマッチ優先。 */
  match: string[];
};

const TABS: readonly TabItem[] = [
  { key: "home", label: "Home", jp: "ホーム", href: "/app", match: ["/app"] },
  {
    key: "record",
    label: "Record",
    jp: "録る",
    href: "/diary",
    // /diary は完全一致、/diary/history や /diary/insights は archive 側が拾う
    match: ["/diary"],
  },
  {
    key: "archive",
    label: "Archive",
    jp: "記録",
    href: "/diary/history",
    match: ["/diary/history", "/diary/insights"],
  },
  { key: "me", label: "Me", jp: "じぶん", href: "/me", match: ["/me"] },
] as const;

// 最長一致を優先したいので、match の最大長で事前ソート。
// TABS は不変なのでモジュール評価時に 1 度だけ計算する（毎レンダリングのコスト回避）。
const SORTED_TABS = [...TABS].sort(
  (a, b) => Math.max(...b.match.map((m) => m.length)) - Math.max(...a.match.map((m) => m.length))
);

function resolveActive(pathname: string): TabKey | null {
  // @/i18n/routing の usePathname は locale プリフィックス除去済みで返す（例：/en/me → /me）。
  for (const tab of SORTED_TABS) {
    for (const m of tab.match) {
      if (pathname === m || pathname.startsWith(`${m}/`)) {
        return tab.key;
      }
    }
  }
  return null;
}

export function BottomTab() {
  const pathname = usePathname();
  const active = resolveActive(pathname);

  return (
    <nav
      aria-label="Primary"
      className="grid grid-cols-4 border-t border-[var(--border)] pt-[10px]"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="flex flex-col items-center gap-[2px] no-underline"
            style={{ color: isActive ? "var(--fg)" : "var(--fg-muted)" }}
          >
            <span
              style={{
                fontFamily: isActive
                  ? 'var(--font-serif), "Noto Serif JP", serif'
                  : "var(--font-jakarta), var(--font-noto), sans-serif",
                fontStyle: isActive ? "italic" : "normal",
                fontSize: isActive ? 13 : 11,
                fontWeight: 400,
                letterSpacing: "-0.005em",
              }}
            >
              {tab.label}
            </span>
            <span className="text-[8px] tracking-[0.2em] opacity-55">{tab.jp}</span>
          </Link>
        );
      })}
    </nav>
  );
}
