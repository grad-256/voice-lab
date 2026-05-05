// /login は AuthDialog 導入により廃止。
// middleware が直アクセスを /diary に 302 リダイレクトするが、二重安全として page でも redirect する。
// 再ログインは /diary 到達後に AuthGate が自動でダイアログを開く（未ログイン時）。

import { redirect } from "@/i18n/routing";

export const runtime = "edge";

export default async function LoginRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/diary", locale });
}
