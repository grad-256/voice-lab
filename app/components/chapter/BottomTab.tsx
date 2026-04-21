"use client";

// Chapter 系譜の下部タブバー。Home / Record / Archive / Me の 4 タブ。
// 全タブで同じ sans family を保ち、アクティブはサイズ・ウェイト・色で差をつける
// （以前はアクティブだけ Fraunces italic に切り替えていたが、JA 副ラベルは sans のままで
// 「Me / じぶん」のペアの声が揃わなかったため撤去）。
// 未対応パスでは active を渡さないことで全タブが非アクティブ表示になる（LP など）。

import { Link, usePathname } from "@/i18n/routing";
import { SANS_FAMILY } from "@/lib/typography";

type TabKey = "home" | "record" | "archive" | "me";

type TabItem = {
  key: TabKey;
  label: string;
  href: string;
  /** アクティブ判定に使う path のプレフィックス。最も長いマッチ優先。 */
  match: string[];
};

const TABS: readonly TabItem[] = [
  { key: "home", label: "Home", href: "/app", match: ["/app"] },
  {
    key: "record",
    label: "Record",
    href: "/diary",
    // /diary は完全一致、/diary/history や /diary/insights は archive 側が拾う
    match: ["/diary"],
  },
  {
    key: "archive",
    label: "Archive",
    href: "/diary/history",
    match: ["/diary/history", "/diary/insights"],
  },
  { key: "me", label: "Me", href: "/me", match: ["/me"] },
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

  // 画面下固定（position: fixed）。
  // - 背景は var(--bg) で塗り、スクロール時に後ろの本文が透けないようにする
  // - iOS セーフエリアを env(safe-area-inset-bottom) で吸収
  // - 外側の <nav> は横幅 100% で縁まで伸ばし、中の grid は max-w-md に収める
  // 利用ページ側は main 末尾の `pb-*` を十分に確保すること（tab の高さ + セーフエリア）。
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--border)]"
      style={{
        backgroundColor: "var(--bg)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="grid grid-cols-4 max-w-md mx-auto px-7 pt-[10px] pb-[10px]">
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
                className={
                  isActive
                    ? "text-sm sm:text-base tracking-tight"
                    : "text-xs sm:text-sm tracking-tight"
                }
                style={{
                  fontFamily: SANS_FAMILY,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
