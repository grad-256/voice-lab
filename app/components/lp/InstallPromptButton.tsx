"use client";

import { usePwaInstall } from "@/lib/usePwaInstall";

type Props = {
  label: string;
  className?: string;
};

// `beforeinstallprompt` が発火したときだけ描画される PWA インストールボタン。
// iOS Safari / Firefox のような非対応環境では何も出さないため、
// Server Component 側では単純に placing するだけでよい。
//
// 副作用：OS ダイアログ承諾時と、Chrome メニュー等の外部経路からのインストール成功時に、
// `usePwaInstall` が LP の browser タブを `/app` に自動遷移させる。このボタン自体は
// 遷移せず onClick で OS ダイアログを呼ぶだけだが、「押した結果ページが切り替わる」
// 挙動になる点に注意（他の Hero CTA はロケール付き `<Link>` による SPA ナビゲーション）。
export function InstallPromptButton({ label, className }: Props) {
  const { canInstall, promptInstall } = usePwaInstall();
  if (!canInstall) return null;
  return (
    <button type="button" onClick={promptInstall} className={className}>
      {label}
    </button>
  );
}
