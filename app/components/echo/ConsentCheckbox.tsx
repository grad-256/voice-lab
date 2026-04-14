"use client";

/**
 * 「分身の声」作成フローの同意 UI（Sprint 1 / mvp-scope.md 3.10 節・7.Q7 パターン A）。
 *
 * 責務：
 * - Q7 パターン A の固定文言を表示
 * - チェック状態を親に伝える（親側で録音開始ボタンの disabled を制御する前提）
 *
 * 非責務：
 * - 録音開始の制御（VoiceRecorder の `disabled` prop で親が統合する）
 * - 同意ステータスの永続化（本 MVP ではセッション内のみ、DB に保存しない）
 */

export interface ConsentCheckboxProps {
  /** 現在のチェック状態 */
  checked: boolean;
  /** チェック状態変更時のコールバック */
  onChange: (checked: boolean) => void;
  /** disabled 化（録音中など、状態を固定したいとき） */
  disabled?: boolean;
}

export function ConsentCheckbox({ checked, onChange, disabled = false }: ConsentCheckboxProps) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 text-sm leading-relaxed text-gray-300">
      <h2 className="mb-3 text-base font-semibold text-white">
        「分身の声」を作る前に、ご確認ください
      </h2>

      <p className="mb-3">
        これからマイクで 10〜30
        秒ほどのあなたの声を録音します。録音された音声と、そこから計算される声の特徴データは、
        <strong className="font-semibold text-white">
          すべてあなたのブラウザ内だけで処理され、当サービスのサーバーには一切送信されません
        </strong>
        。ブラウザを閉じた時点で、録音データも特徴データも消えます。
      </p>

      <p className="mb-3">
        作成される「分身の声」は、あなたの声を複製・合成したものではありません。ElevenLabs
        社が提供する公開音声ライブラリの中から、あなたの声と似た特徴を持つ
        <strong className="font-semibold text-white">別の人の声</strong>
        を候補としてお見せするものです。類似度はあくまで推定であり、完全一致を保証するものではありません。
      </p>

      <p className="mb-3">
        保存されるのは、あなたが選んだ候補の識別番号（voice_id）のみです。あなたの声そのもの、および声の特徴データは当サービスのどこにも残りません。
      </p>

      <p className="mb-4">
        同意を取り消したい場合は、マイページの「分身の声を削除」からいつでも選択した voice_id
        を削除できます。
      </p>

      <label className="flex items-start gap-3 rounded-lg bg-gray-800/70 p-3 ring-1 ring-gray-700 cursor-pointer has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 accent-rose-500"
          data-testid="echo-consent-checkbox"
        />
        <span className="text-white">
          上記の内容を理解し、録音とブラウザ内での特徴量抽出に同意します。
        </span>
      </label>
    </section>
  );
}
