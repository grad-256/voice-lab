"use client";

// PWA インストール導線用フック。
// Android Chrome / PC Chrome / Edge が発火する `beforeinstallprompt` を捕まえ、
// ボタンから OS のインストールダイアログを呼べるようにする。
// iOS Safari / Firefox など `beforeinstallprompt` 非対応ブラウザでは
// `canInstall` が false のままとなり、呼び出し側はボタンを自動的に非表示にできる。
//
// 前提：このフックは `PostHogProvider`（app/components/PostHogProvider.tsx）配下で使うこと。
// PostHog は親の useEffect で非同期に init されるため、init 未了の瞬間に capture が
// no-op となって計測を取りこぼす可能性がある。`posthog.__loaded` をガードに使い、
// 初期化が完了するまで shown イベントも「送った」扱いにしないことでロスを防ぐ。
//
// 副作用：インストール成功時（LP 上のボタン経由 or Chrome メニュー等の外部経路）に
// 同じブラウザタブを `/app` に遷移させる。PWA 側は manifest の start_url=/app で起動
// するが、従来の browser タブも揃えて「インストール直後からアプリ内部」体験を作る。

import { useRouter } from "@/i18n/routing";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";

type PromptOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: PromptOutcome; platform: string }>;
  prompt(): Promise<void>;
}

export function usePwaInstall() {
  const router = useRouter();
  // router は毎 render で新しい参照になる可能性があるため ref に逃がし、
  // `promptInstall` の再生成を `deferredPrompt` だけに依存させる。
  const routerRef = useRef(router);
  routerRef.current = router;

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  // 「ボタンが表示可能になった」瞬間のイベントを 1 回だけ送るためのガード
  const shownCapturedRef = useRef(false);
  // promptInstall の await 中にアンマウントされた場合、遷移を抑止するためのガード。
  // （PostHog 計測は送る。遷移だけ取り消して競合ルーティングを避ける）
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // client component は SSR でも評価されるため明示的にガードする。
    // 補足：`beforeinstallprompt` は Chrome が install criteria を満たした直後に
    // 一度だけ発火する。LP 直ランディングの初回ロードで捕まえる前提で登録する。
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(display-mode: standalone)");
    if (mql.matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Chrome メニューやアドレスバー右端からの外部経路でインストールが成功した場合、
    // `userChoice` は経由せず `appinstalled` だけが発火する。LP タブの一貫した
    // 「インストール直後は /app 起点」体験のため、ここでも routerRef 経由で遷移する。
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (mountedRef.current) {
        routerRef.current.push("/app");
      }
    };

    // `appinstalled` が発火しない環境（一部の Chromium 変種 / 手動インストール）でも
    // display-mode の変化を拾って isInstalled を更新する保険。
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mql.addEventListener("change", handleDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mql.removeEventListener("change", handleDisplayChange);
    };
  }, []);

  useEffect(() => {
    if (!deferredPrompt || isInstalled || shownCapturedRef.current) return;
    // PostHog init 未了なら送信も「送信済み」扱いも保留し、次の render で再評価させる。
    // こうすることで Provider の init が後から完了しても初回 shown を取り逃さない。
    if (!posthog.__loaded) return;
    shownCapturedRef.current = true;
    posthog.capture("pwa_install_button_shown");
  }, [deferredPrompt, isInstalled]);

  const promptInstall = useCallback(async () => {
    // 再入防止：Chrome は同一 beforeinstallprompt イベントに対する 2 回目の prompt() を
    // 仕様違反として投げるため、先頭で local 変数に退避して state を即クリアする。
    // dismissed の場合もイベントは使い捨てになる（Chrome はクールダウンを挟むまで再発火
    // しないため）。保持せず破棄する方針でユーザー体験と整合する。
    const ev = deferredPrompt;
    if (!ev) return;
    setDeferredPrompt(null);

    if (posthog.__loaded) {
      posthog.capture("pwa_install_button_clicked");
    }
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (posthog.__loaded) {
      posthog.capture("pwa_install_prompt_outcome", { outcome });
    }
    // インストール成功時は LP タブも /app に遷移させ、直後から「アプリ内部」に居る
    // 体験を作る。PWA 側は manifest の start_url=/app で起動するが、ブラウザタブは
    // LP のまま残るため、そちらも揃える。
    // await 中にアンマウントされていた場合は別経路の遷移と競合しないよう抑止する。
    if (outcome === "accepted" && mountedRef.current) {
      routerRef.current.push("/app");
    }
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  };
}
