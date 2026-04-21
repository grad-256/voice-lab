// Chapter 系譜で使う日付・日時フォーマッタ。
// ページ側で同じロジックを書き散らしていたのを集約する。
// - MONO 表示：archive 行や詳細ヘッダなど「活字のリズム」を作る場所で使う
// - Cap 表示 ：章題の前に添える EN 固定の weekday + 月日

// 曜日を uppercase の短い表記に揃える。
// JA の "月曜日" / "月" → "MON" に、EN の "Mon" → "MON" に正規化する。
function weekdayUpper(d: Date, locale: string): string {
  const tag = locale === "ja" ? "ja-JP" : "en-US";
  return d.toLocaleDateString(tag, { weekday: "short" }).replace(/曜日?/, "").toUpperCase();
}

// 「WED · 04·21·26 · 07:42」形式。Chapter 詳細画面のヘッダで使う。
export function formatMonoDateTime(iso: string, locale: string): string {
  const d = new Date(iso);
  const weekday = weekdayUpper(d, locale);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${weekday} · ${m}·${dd}·${yy} · ${h}:${min}`;
}

// 「4·21·26」形式の MONO 表示。Chapter の archive 行で「日付箱」の下に添える。
export function formatMonoDate(
  iso: string,
  locale: string
): {
  day: string;
  dayNum: string;
  month: string;
} {
  const d = new Date(iso);
  const month =
    locale === "ja"
      ? `${d.getMonth() + 1}月`.toUpperCase()
      : d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return {
    day: weekdayUpper(d, locale),
    dayNum: String(d.getDate()).padStart(2, "0"),
    month,
  };
}

// 日付の "Cap" 表示。JA/EN ロケール問わず Chapter 系譜として英語固定
// （下の 7 日グリッドも Mon/Tue/… 英語固定なので、同一画面での二重描画を避ける）。
export function formatDateCap(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const md = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday} · ${md}`;
}

// "Jan 2026" / "2026年1月" の Member since 表示。失敗時は空文字で安全側に倒す。
export function formatMemberSince(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  const tag = locale === "ja" ? "ja-JP" : "en-US";
  return d.toLocaleDateString(tag, { year: "numeric", month: "short" });
}
