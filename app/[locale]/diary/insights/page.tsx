// フリーアルファリリース時点では Insights は未準備のため、アクセスされた場合は 404 を返す。
// 実装の準備ができたら notFound() の import・呼び出しを削除し、
// git log でこのファイルの旧コミットを参照して UI を復活させる。
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

export default function DiaryInsightsPage() {
  notFound();
}
