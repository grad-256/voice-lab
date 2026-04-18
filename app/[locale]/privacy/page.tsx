// プライバシーポリシーページ（静的）
// Cloudflare Pages の非静的ルート要件を満たすため Edge Runtime を明示
export const runtime = "edge";

export default function PrivacyPage() {
  return (
    <main className="flex-1 w-full bg-gray-950 text-gray-300 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">プライバシーポリシー</h1>
        <p className="text-sm text-gray-500 mb-10">最終更新日：2026年3月27日</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">1. 運営者</h2>
          <p className="text-sm leading-relaxed">
            本サービス「MyVoiceLab」は、個人により運営されています。
            <br />
            お問い合わせ先：
            <a
              href="mailto:m.miyaudi@uclab-w.com"
              className="text-indigo-400 hover:text-indigo-300 transition-colors ml-1"
            >
              m.miyaudi@uclab-w.com
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">2. 収集する情報</h2>
          <p className="text-sm leading-relaxed">本サービスは、以下の情報を収集します。</p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>メールアドレス（アカウント登録時）</li>
            <li>音声データ（会話練習時に録音された音声。文字起こし処理後に即時破棄されます）</li>
            <li>会話履歴（セッション中のみ保持。ブラウザを閉じると消去されます）</li>
            <li>アクセスログ（IPアドレス・リクエスト情報。Cloudflare によるサーバーログ）</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">3. 利用目的</h2>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>アカウントの識別・認証</li>
            <li>AI 音声会話サービスの提供（音声認識・AI 対話・音声合成）</li>
            <li>サービスの改善・障害対応・不正利用の防止</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">
            4. 業務委託先への情報提供（外国含む）
          </h2>
          <p className="text-sm leading-relaxed">
            本サービスは、サービス提供のために以下の事業者に処理を委託しています。
            委託先はすべて米国に拠点を置く企業であり、個人データが日本国外（米国）のサーバーで処理されます。
            米国は日本と同等の個人情報保護制度を有していませんが、各社は独自のセキュリティ基準・プライバシーポリシーに基づきデータを管理しています。
            各社のプライバシーポリシーもご確認ください。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>Supabase, Inc.（米国）— 認証・データ管理</li>
            <li>OpenAI, L.L.C.（米国）— 音声認識（Whisper）</li>
            <li>Anthropic, PBC（米国）— AI 対話（Claude）</li>
            <li>ElevenLabs, Inc.（米国）— 音声合成</li>
            <li>Cloudflare, Inc.（米国）— ホスティング・アクセスログ</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            上記委託先以外の第三者に個人情報を提供することはありません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">5. 安全管理措置</h2>
          <p className="text-sm leading-relaxed">
            本サービスは、個人データの漏えい・滅失・毀損を防止するため、以下の措置を講じています。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>通信の全区間における HTTPS 暗号化</li>
            <li>Supabase Auth による認証・アクセス制御</li>
            <li>音声データの処理後即時破棄（サーバーへの保存なし）</li>
            <li>各委託先のセキュリティ基準の確認</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">6. 外部送信</h2>
          <p className="text-sm leading-relaxed">
            本サービスは、サービス提供にあたり以下の情報を外部に送信します。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>音声データ → OpenAI（文字起こしのため）</li>
            <li>テキスト（会話内容）→ Anthropic（AI 返答生成のため）</li>
            <li>テキスト（AI 返答）→ ElevenLabs（音声合成のため）</li>
            <li>アクセスログ → Cloudflare（ホスティング・セキュリティのため）</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">7. 保存期間</h2>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>メールアドレス：アカウント削除まで保持</li>
            <li>音声データ：文字起こし処理完了後に即時破棄</li>
            <li>会話履歴：セッション終了時に破棄</li>
            <li>アクセスログ：Cloudflare の保持ポリシーに準じます</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">8. 開示・訂正・利用停止請求</h2>
          <p className="text-sm leading-relaxed">
            ユーザーは、個人情報保護法に基づき、以下の請求を行うことができます。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>保有する個人情報の開示請求</li>
            <li>内容の訂正・追加・削除請求</li>
            <li>利用停止・消去請求</li>
            <li>第三者提供停止請求</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            請求はお問い合わせ先メールアドレスまでご連絡ください。本人確認のうえ、
            原則として14営業日以内に無料で対応します。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">9. アカウント削除</h2>
          <p className="text-sm leading-relaxed">
            退会希望の場合は、お問い合わせ先までご連絡ください。
            アカウントおよび関連する個人情報を削除します。
            サービス終了時も同様に、保有する個人情報を適切に削除します。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">10. お問い合わせ</h2>
          <p className="text-sm leading-relaxed">
            プライバシーに関するお問い合わせは以下までご連絡ください。
            <br />
            <a
              href="mailto:m.miyaudi@uclab-w.com"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              m.miyaudi@uclab-w.com
            </a>
          </p>
        </section>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            ← トップに戻る
          </a>
        </div>
      </div>
    </main>
  );
}
