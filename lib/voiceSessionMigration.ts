/**
 * ゲスト → 認証ユーザー移行：localStorage の selected_voice_id を
 * `POST /api/voice-session` に upsert して、成功したら localStorage を消す。
 *
 * mvp-scope.md 3.7 節「ゲスト → 認証ユーザーへの移行経路」の本体ロジック。
 *
 * 純粋関数として依存（fetch / localStorage アクセサ）を引数で受け取り、
 * Vitest からも DOM なしで検証できる形にする。React コンポーネント
 * （AuthMigrationListener）からは依存を本物で渡して呼び出す。
 */

const MAX_VOICE_ID_LENGTH = 64;

export type MigrationResult =
  | { migrated: true; voiceId: string }
  | {
      migrated: false;
      reason: "no-local" | "invalid-local" | "unauthenticated" | "api-error";
    };

export interface MigrationDeps {
  /**
   * localStorage から selected_voice_id を取得（無ければ null）。
   * 通常は `getGuestSelectedVoiceId` を渡す。
   */
  getLocal: () => string | null;
  /**
   * localStorage の selected_voice_id を消す。
   * 通常は `clearGuestSelectedVoiceId` を渡す。
   */
  clearLocal: () => void;
  /**
   * fetch 互換関数。本番では globalThis.fetch、テストではモック。
   */
  fetch: typeof fetch;
}

/**
 * ゲスト時に localStorage に保存された voice_id を、認証 API に upsert する。
 *
 * 呼び出し側責務：
 *   - 認証済みユーザーの onAuthStateChange("SIGNED_IN") タイミングで呼ぶ
 *   - 同セッション内で多重に呼ばないようガードする（重複 upsert を避ける）
 *
 * 副作用：
 *   - 成功時：localStorage の selected_voice_id を削除
 *   - 不正値（空文字 / 改行 / 長すぎ）：localStorage を削除（壊れたデータの除去）
 *   - 失敗時（401 / その他）：localStorage は保持（次回のリトライに残す）
 */
export async function migrateGuestVoiceToAuth(deps: MigrationDeps): Promise<MigrationResult> {
  const local = deps.getLocal();
  if (local === null) {
    return { migrated: false, reason: "no-local" };
  }

  // 不正データはサーバーに送る前にクリアする（API 側のバリデーションで 400 になる前提だが、
  // 壊れた値を localStorage に置き続ける意味がない）
  if (local.length === 0 || local.length > MAX_VOICE_ID_LENGTH || /[\r\n\t]/.test(local)) {
    deps.clearLocal();
    return { migrated: false, reason: "invalid-local" };
  }

  let res: Response;
  try {
    res = await deps.fetch("/api/voice-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedVoiceId: local }),
    });
  } catch {
    // ネットワーク断・CORS 等：localStorage は保持して次回リトライ可能にする
    return { migrated: false, reason: "api-error" };
  }

  if (res.status === 401) {
    // セッション未確立等：localStorage 保持。次の SIGNED_IN タイミングで再試行
    return { migrated: false, reason: "unauthenticated" };
  }

  if (!res.ok) {
    return { migrated: false, reason: "api-error" };
  }

  // 成功：localStorage を削除して引き継ぎ完了
  deps.clearLocal();
  return { migrated: true, voiceId: local };
}
