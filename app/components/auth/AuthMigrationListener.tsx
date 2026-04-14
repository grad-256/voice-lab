"use client";

import { createClient } from "@/lib/supabase/client";
import { migrateGuestVoiceToAuth } from "@/lib/voiceSessionMigration";
import { clearGuestSelectedVoiceId, getGuestSelectedVoiceId } from "@/lib/voiceSessionStorage";
import { useCallback, useEffect, useRef, useState } from "react";
import { MigrationToast } from "./MigrationToast";

/**
 * ゲスト → 認証ユーザー移行を Supabase の `onAuthStateChange` で発火させるリスナー。
 *
 * mvp-scope.md 3.7 節：
 *   - SIGNED_IN イベントで localStorage の selected_voice_id を `/api/voice-session` に upsert
 *   - 成功時に「あなたの分身の声を引き継ぎました」トースト表示
 *
 * 設計：
 *   - UI は MigrationToast 経由のみ（このコンポーネント自体は通常時は何もレンダーしない）
 *   - 同一セッション内の二重発火を `hasMigratedRef` で防ぐ（onAuthStateChange は
 *     INITIAL_SESSION + SIGNED_IN など複数回発火することがある）
 *   - アンマウント時に subscription を解除
 */

const TOAST_MESSAGE = "あなたの分身の声を引き継ぎました";

export function AuthMigrationListener() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // 同一マウント中の二重発火防止。Supabase は同一セッションで複数回イベントを発火しうる
  const hasMigratedRef = useRef(false);

  const handleDismiss = useCallback(() => {
    setToastMessage(null);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session) return;
      if (hasMigratedRef.current) return;

      // ゲスト時の値が無ければ何もしない（fetch も走らない）
      if (getGuestSelectedVoiceId() === null) return;

      hasMigratedRef.current = true;

      void migrateGuestVoiceToAuth({
        getLocal: getGuestSelectedVoiceId,
        clearLocal: clearGuestSelectedVoiceId,
        fetch: globalThis.fetch.bind(globalThis),
      })
        .then((result) => {
          if (result.migrated) {
            setToastMessage(TOAST_MESSAGE);
          } else if (result.reason === "unauthenticated" || result.reason === "api-error") {
            // リトライ可能な失敗なので、次回 SIGNED_IN で再試行できるようフラグを戻す
            hasMigratedRef.current = false;
          }
          // invalid-local / no-local の場合はリトライ不要なので hasMigratedRef は true のままにする
        })
        .catch((err) => {
          // migrateGuestVoiceToAuth は内部で例外を全て握っているため通常ここには来ないが、
          // 万一の reject でも次回 SIGNED_IN でリトライできるようフラグを戻す
          console.error("voice session migration unexpected error:", err);
          hasMigratedRef.current = false;
        });
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (toastMessage === null) return null;
  return <MigrationToast message={toastMessage} onDismiss={handleDismiss} />;
}
