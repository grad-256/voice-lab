// プライバシーポリシーページ（静的）
// Cloudflare Pages の非静的ルート要件を満たすため Edge Runtime を明示
import { Link } from "@/i18n/routing";

export const runtime = "edge";

export default function PrivacyPage() {
  return (
    <main className="flex-1 w-full bg-[var(--bg)] text-[var(--fg-muted)] px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-2">プライバシーポリシー</h1>
        <p className="text-sm text-[var(--fg-subtle)] mb-10">最終更新日：2026年4月20日</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">1. 運営者</h2>
          <p className="text-sm leading-relaxed">
            本サービス「MyVoiceLab」は、合同会社UCLab（以下「当社」）が運営しています。
          </p>
          <ul className="mt-3 space-y-1 text-sm list-disc list-inside">
            <li>事業者の名称：合同会社UCLab</li>
            <li>代表者氏名：宮宇地勝</li>
            <li>
              事業者の住所：〒530-0011
              大阪府大阪市北区大深町６番３８号グラングリーン大阪北館ＪＡＭＢＡＳＥ６階ＪＡＭ－ＤＥＳＫ
            </li>
            <li>
              お問い合わせ先：
              <a
                href="mailto:m.miyaudi@uclab-w.com"
                className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors ml-1"
              >
                m.miyaudi@uclab-w.com
              </a>
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">2. 取得する情報</h2>
          <p className="text-sm leading-relaxed">当社は、お客様から以下の情報を取得します。</p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>氏名（ニックネームやペンネームを含む）</li>
            <li>メールアドレス（アカウント登録時）</li>
            <li>
              お客様が録音した音声データ（音声日記・対話の録音を含む。文字起こし処理後に即時破棄されます）
            </li>
            <li>音声から生成されたテキスト（日記本文・対話履歴）</li>
            <li>写真や動画（将来の機能拡張で取得する場合があります）</li>
            <li>位置情報（将来の機能拡張で取得する場合があります）</li>
            <li>
              クレジットカード、銀行口座、電子マネー等の決済手段に関する情報（有料プラン利用時）
            </li>
            <li>Cookie を用いて生成された識別情報</li>
            <li>当社ウェブサイトおよびアプリにおけるお客様の行動履歴・利用履歴</li>
            <li>アクセスログ（IPアドレス・リクエスト情報。Cloudflare によるサーバーログ）</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            なお、お客様の音声データおよびテキストデータは、当社または当社が利用する第三者サービスによって
            AI モデルの学習に使用されることはありません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">3. 利用目的</h2>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>当社サービスに関する登録の受付、お客様の本人確認、認証のため</li>
            <li>お客様が録音した音声データを文字起こしし、AI による応答・要約を生成するため</li>
            <li>お客様の当社サービスの利用履歴を管理するため</li>
            <li>利用料金の決済のため</li>
            <li>当社サービスにおけるお客様の行動履歴を分析し、サービスの維持改善に役立てるため</li>
            <li>当社のサービスに関するご案内、お問い合わせへの対応のため</li>
            <li>当社の規約や法令に違反する行為に対応するため</li>
            <li>当社サービスの変更、提供中止、終了、契約解除のご連絡のため</li>
            <li>当社規約の変更等を通知するため</li>
            <li>上記のほか、当社サービスの提供、維持、保護および改善のため</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">
            4. 業務委託先への情報提供（外国にある第三者への提供を含む）
          </h2>
          <p className="text-sm leading-relaxed">
            当社は、サービス提供のために以下の事業者に処理を委託しています。
            委託先はすべて米国に拠点を置く企業であり、個人データが日本国外（米国）のサーバーで処理されます。
            お客様は、本プライバシーポリシーへの同意により、個人情報保護法第28条に基づく外国にある第三者への個人データの提供に同意したものとみなします。
            各社のプライバシーポリシーもあわせてご確認ください。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>
              Supabase, Inc.（米国）— 認証・データベース（
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
              >
                プライバシーポリシー
              </a>
              ）
            </li>
            <li>
              OpenAI, L.L.C.（米国）— 音声の文字起こし（Whisper）（
              <a
                href="https://openai.com/policies/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
              >
                プライバシーポリシー
              </a>
              ）
            </li>
            <li>
              Anthropic, PBC（米国）— テキスト応答・要約の生成（Claude）（
              <a
                href="https://www.anthropic.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
              >
                プライバシーポリシー
              </a>
              ）
            </li>
            <li>
              ElevenLabs, Inc.（米国）— テキストから音声の生成（TTS）（
              <a
                href="https://elevenlabs.io/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
              >
                プライバシーポリシー
              </a>
              ）
            </li>
            <li>
              Cloudflare, Inc.®（米国）— ホスティング・アクセスログ（
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
              >
                プライバシーポリシー
              </a>
              ）
            </li>
            <li>
              PostHog Inc.（米国）— アクセス解析・プロダクト改善（
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
              >
                プライバシーポリシー
              </a>
              ）
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            各事業者の所在国における個人情報保護制度および各事業者が講じる個人情報保護のための措置に関する情報は、末尾記載のお問い合わせ先までご連絡いただければ、個別にご回答いたします。
            上記委託先以外の第三者に個人情報を提供することはありません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">5. 安全管理措置</h2>
          <p className="text-sm leading-relaxed">
            当社は、個人データの漏えい・滅失・毀損を防止するため、以下の措置を講じています。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>通信の全区間における HTTPS 暗号化</li>
            <li>Supabase Auth による認証・アクセス制御</li>
            <li>音声データの処理後即時破棄（サーバーへの永続保存なし）</li>
            <li>各委託先のセキュリティ基準の確認</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            その他の安全管理措置の詳細については、末尾記載のお問い合わせ先にご連絡いただければ、法令の定めに従い個別にご回答いたします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">6. 外部送信</h2>
          <p className="text-sm leading-relaxed">
            当社は、サービス提供にあたり以下の情報を外部に送信します。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>音声データ → OpenAI（文字起こしのため）</li>
            <li>テキスト（日記本文・会話内容）→ Anthropic（要約・AI 応答生成のため）</li>
            <li>テキスト → ElevenLabs（音声再生が必要な場合の音声合成のため）</li>
            <li>利用イベント（画面遷移・操作ログ等）→ PostHog（アクセス解析のため）</li>
            <li>アクセスログ → Cloudflare（ホスティング・セキュリティのため）</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">7. 保存期間</h2>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>メールアドレス：アカウント削除まで保持</li>
            <li>音声データ：文字起こし処理完了後に即時破棄</li>
            <li>日記本文・対話履歴：お客様が削除するまで保持</li>
            <li>アクセスログ：Cloudflare および PostHog の保持ポリシーに準じます</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">
            8. 開示・訂正・利用停止請求
          </h2>
          <p className="text-sm leading-relaxed">
            お客様は、個人情報保護法に基づき、以下の請求を行うことができます。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>保有する個人情報の開示請求</li>
            <li>内容の訂正・追加・削除請求</li>
            <li>利用停止・消去請求</li>
            <li>第三者提供停止請求</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            請求はお問い合わせ先メールアドレスまでご連絡ください。この場合、運転免許証のご提示等、当社が指定する方法によりご本人からのご請求であることを確認させていただきます。
            本人確認のうえ、原則として14営業日以内に対応します。
            なお、情報の開示請求については、開示の有無にかかわらず、ご申請時に一件あたり1,000円の事務手数料を申し受けます。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">9. アカウント削除</h2>
          <p className="text-sm leading-relaxed">
            ご自身での退会は、ログイン後、マイページ（「アカウント削除」）からお手続きいただけます。
            お手続きに関するご不明点や、セルフサービスでの削除が難しい場合は、お問い合わせ先までご連絡ください。
            退会に伴い、アカウントおよび関連する個人情報を削除します。
            サービス終了時も同様に、保有する個人情報を適切に削除します。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">
            10. プライバシーポリシーの変更
          </h2>
          <p className="text-sm leading-relaxed">
            当社は、必要に応じて本プライバシーポリシーの内容を変更します。
            変更後のプライバシーポリシーの施行時期と内容は、適切な方法により周知または通知します。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">11. お問い合わせ</h2>
          <p className="text-sm leading-relaxed">
            プライバシーに関するお問い合わせは以下までご連絡ください。
            <br />
            <a
              href="mailto:m.miyaudi@uclab-w.com"
              className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
            >
              m.miyaudi@uclab-w.com
            </a>
          </p>
        </section>

        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <Link
            href="/"
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
          >
            ← トップに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
