// 利用規約ページ（静的）
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-300 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">利用規約</h1>
        <p className="text-sm text-gray-500 mb-10">最終更新日：2026年3月27日</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">1. サービスの概要</h2>
          <p className="text-sm leading-relaxed">
            MyVoiceLab（以下「本サービス」）は、AI を活用した音声会話練習サービスです。
            本規約は、本サービスを利用するすべてのユーザーに適用されます。
            アカウントを作成した時点で、本規約に同意したものとみなします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">2. 禁止事項</h2>
          <p className="text-sm leading-relaxed">ユーザーは以下の行為を行ってはなりません。</p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>法令または公序良俗に違反する行為</li>
            <li>本サービスへの不正アクセスや過度な負荷をかける行為</li>
            <li>他のユーザーまたは第三者を誹謗中傷する行為</li>
            <li>本サービスを商業目的で無断利用する行為</li>
            <li>虚偽の情報を登録する行為</li>
            <li>その他、運営者が不適切と判断する行為</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">3. 免責事項</h2>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>
              本サービスの AI による回答・音声認識結果の正確性を保証しません。
              学習目的での参考情報としてご利用ください。
            </li>
            <li>
              通信環境・外部 API（OpenAI・Anthropic・ElevenLabs）の障害による
              サービス停止について、責任を負いません。
            </li>
            <li>本サービスの利用により生じた損害について、運営者は一切の責任を負いません。</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">4. サービスの変更・終了</h2>
          <p className="text-sm leading-relaxed">
            運営者は、ユーザーへの事前通知なく本サービスの内容を変更、または提供を終了することがあります。
            サービス終了時は可能な限り事前にお知らせしますが、やむを得ない場合を除きます。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">5. 規約の変更</h2>
          <p className="text-sm leading-relaxed">
            本規約は必要に応じて改定することがあります。
            重要な変更がある場合はサービス上でお知らせします。
            改定後も本サービスを継続利用した場合、変更後の規約に同意したものとみなします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">6. 準拠法・管轄裁判所</h2>
          <p className="text-sm leading-relaxed">
            本規約は日本法に準拠します。
            本サービスに関する紛争については、運営者の所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">7. お問い合わせ</h2>
          <p className="text-sm leading-relaxed">
            本規約に関するお問い合わせは以下までご連絡ください。
            <br />
            <a
              href="mailto:m.miyaudi@uclab-w.com"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              m.miyaudi@uclab-w.com
            </a>
          </p>
        </section>

        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-6">
          <a
            href="/privacy"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            プライバシーポリシー
          </a>
          <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            ← トップに戻る
          </a>
        </div>
      </div>
    </main>
  );
}
