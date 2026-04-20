// 利用規約ページ（静的）
// Cloudflare Pages の非静的ルート要件を満たすため Edge Runtime を明示
import { Link } from "@/i18n/routing";

export const runtime = "edge";

export default function TermsPage() {
  return (
    <main className="flex-1 w-full bg-[var(--bg)] text-[var(--fg-muted)] px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-2">利用規約</h1>
        <p className="text-sm text-[var(--fg-subtle)] mb-10">最終更新日：2026年4月20日</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">はじめに</h2>
          <p className="text-sm leading-relaxed">
            MyVoiceLab（以下「本サービス」）は、合同会社UCLab（以下「当社」）が提供する、音声入力による日記・対話記録および
            AI による要約・応答サービスです。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            この利用規約（以下「本規約」）は、本サービス（本サイトを含むものとし、以下、特に両者を区別しません。）の利用条件を定めるものです。本規約は、ユーザー登録の有無にかかわらず、本サービスを利用するすべての者に適用されます。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">1. 本規約への同意</h2>
          <p className="text-sm leading-relaxed">
            ユーザーは、本サービスを利用することによって、本規約に有効かつ取り消し不能な同意をしたものとみなされます。本規約に同意しないユーザーは、本サービスをご利用いただけません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">2. 利用登録</h2>
          <p className="text-sm leading-relaxed">
            本サービスの利用を希望する方は、本規約に同意のうえ、当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、本サービスの利用登録をすることができます。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">3. 登録拒否</h2>
          <p className="text-sm leading-relaxed">
            当社は、以下のいずれかの事由があると判断した場合、利用登録の申請を承認しないことがあります。当社は登録拒否の理由について一切の開示義務を負いません。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>虚偽の事項を届け出た場合</li>
            <li>本規約に違反したことがある者からの申請である場合</li>
            <li>その他、当社が利用登録を相当でないと判断した場合</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">4. 未成年による利用</h2>
          <p className="text-sm leading-relaxed">
            ユーザーが未成年である場合には、法定代理人の同意を得たうえで、本サービスを利用してください。
            法定代理人の同意を得ずに本サービスのご利用を開始したユーザーが成年に達した場合、未成年者であった間の利用行為を追認したものとみなします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">5. ログイン情報の管理</h2>
          <p className="text-sm leading-relaxed">
            ユーザーは、自己の責任において、本サービスのログイン情報を適切に管理するものとします。ユーザーは、いかなる場合にも、ログイン情報を第三者に譲渡または貸与し、もしくは第三者と共用することはできません。当社は、ログイン情報が第三者によって使用されたことによって生じた損害につき、当社に故意又は重大な過失がある場合を除き、一切の責任を負いません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">6. サブスクリプション</h2>
          <p className="text-sm leading-relaxed">
            当社が提供する有償のサブスクリプションプランに係る商品・サービスの価格、それ以外に必要となる費用、代金の支払方法と支払時期、商品の引渡しまたはサービス提供の時期、中途解約の可否については、当社の特定商取引法に基づく表示に定めるところによります。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">
            7. 中途解約の場合のサービス提供の有無
          </h2>
          <p className="text-sm leading-relaxed">
            中途解約の場合であっても、元々ご契約いただいた契約期間の終期までの間は、ご解約いただいたプランに係る商品・サービスおよびこれに含まれるコンテンツを継続してご利用いただけます。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">8. コンテンツのご利用</h2>
          <p className="text-sm leading-relaxed">
            当社は、ユーザーに対し、本サービスが提供する文章、画像、動画、音声、音楽、ソフトウェア、プログラム、コードその他のコンテンツについて、本サービスの利用範囲内における私的な利用を許諾します。有償コンテンツについては、当社が定める利用料金の支払が完了した場合に、本サービスの利用範囲内における私的な利用を許諾します。これは、譲渡及び再許諾できない、非独占的な利用権です。この範囲を超えて本サービスが提供するコンテンツを利用することは一切禁止します。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            理由の如何を問わず、ユーザーが本サービスを利用する権利を失った場合、本サービスが提供するコンテンツ（ユーザーがご自身で投稿した音声日記・対話記録を除きます）の利用ができなくなることを、ユーザーはあらかじめ承諾するものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">9. 遅延損害金</h2>
          <p className="text-sm leading-relaxed">
            当社に対する金銭債務の支払を遅滞したユーザーは、当社に対し、年14.6％の割合による遅延損害金を支払うものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">10. ユーザーの投稿</h2>
          <p className="text-sm leading-relaxed">
            ユーザーは、ユーザーの投稿（音声日記・対話記録を含む）に含まれる情報を送信することについて適法な権利を有していること、およびユーザーの投稿が第三者の知的財産権（著作権、特許権、実用新案権、商標権、意匠権（それらの権利を取得し、またはそれらの権利につき登録等を出願する権利を含みます。）またはアイデア、ノウハウ等をいい、以下同様とします。）、所有権その他の権利を侵害していないことについて、当社に対し表明し、保証するものとします。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            ユーザーの投稿に関する著作権は、ユーザー自身に留保されます。当社はユーザーの投稿に関して著作権を取得することはありません。ただし、当社は、本サービスの提供、維持、改善（バックアップ、復元、ユーザー本人への再表示、障害対応、文字起こしや
            AI
            による要約・応答生成のための処理を含みます）に必要な範囲において、無償、無期限かつ地域非限定で、ユーザーの投稿を複製することができるものとします。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            当社は、ユーザーの投稿（音声日記・対話記録）を、一般に公開し、自動公衆送信し、販売し、または第三者に提供することはありません。また、ユーザーの投稿を、当社または第三者による
            AI モデルの学習には使用しません。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            ユーザーは自己の責任において投稿のバックアップを行わなければなりません。当社は、ユーザーの投稿のバックアップを行う義務を負わないものとします。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            ユーザーは、以下のいずれかに該当する情報を投稿してはいけません。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>
              当社または第三者の知的財産権、肖像権、プライバシー、名誉、その他の権利または利益を侵害する情報
            </li>
            <li>
              ユーザーを特定可能な個人情報等を含む情報（ただし、利用登録に必要な場合等当社が求めた場合、その他当社が認めた場合を除きます。）
            </li>
            <li>わいせつな表現を含む情報</li>
            <li>自殺、自傷行為を誘引、勧誘または助長する表現を含む情報</li>
            <li>
              薬物・危険ドラッグの売買に関する情報または薬物・危険ドラッグの不適切な利用を助長する表現を含む情報
            </li>
            <li>宗教的行為、宗教団体、政治的活動、政治団体の宣伝または広告に関する情報</li>
            <li>ネットワークビジネス関連の勧誘等に関する情報</li>
            <li>ジャンクメール、スパムメールに相当する文面を含む情報</li>
            <li>未成年者に悪影響を及ぼすおそれのある情報</li>
            <li>残虐な表現その他他人に不快感を与えるおそれのある情報</li>
            <li>コンピュータウイルス等の不正プログラムを含む情報</li>
            <li>その他当社が不適切と判断する情報</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">11. 禁止事項</h2>
          <p className="text-sm leading-relaxed">
            ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>
              法令、裁判所の判決、決定若しくは命令、または法令上拘束力のある行政措置に違反する行為またはこれらを助長する行為
            </li>
            <li>犯罪行為に関連する行為</li>
            <li>当社や第三者の知的財産権を侵害する行為</li>
            <li>当社や第三者の肖像権、プライバシー、名誉、その他の権利または利益を侵害する行為</li>
            <li>
              当社や第三者のサーバーまたはネットワークに過度の負担をかけたり、その正常な作動を妨害する行為
            </li>
            <li>当社のサービスの運営を妨害するおそれのある行為</li>
            <li>不正アクセスをし、またはこれを試みる行為</li>
            <li>
              逆アセンブル、逆コンパイル、リバースエンジニアリング等によって本サービスのソースコードを解析する行為
            </li>
            <li>
              本サービスに接続しているシステムに権限なく不正にアクセスし、または当社設備に蓄積された情報を不正に書き換え若しくは消去する行為
            </li>
            <li>
              本サービスのウェブサイトやソフトウェアを複製、送信、譲渡、貸与または改変する行為
            </li>
            <li>
              本サービス上のアカウントまたはコンテンツを第三者に有償で貸与、譲渡、売買等をする行為
            </li>
            <li>
              本サービスによって得られた情報（AI
              が生成した音声・要約・応答を含む）を当社の許諾なく商業的に利用・再販する行為
            </li>
            <li>当社が意図しない方法によって本サービスに関連して利益を得ることを目的とする行為</li>
            <li>当社が許諾しない本サービス上での宣伝、広告、勧誘、または営業行為</li>
            <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
            <li>違法、不正または不当な目的を持って本サービスを利用する行為</li>
            <li>本サービスの他のユーザーまたはその他の第三者に不利益、損害、不快感を与える行為</li>
            <li>
              他のユーザーに成りすます行為、または他人の音声・肖像を本人の同意なく本サービス上で再現する行為
            </li>
            <li>他のユーザーのアカウントを利用する行為</li>
            <li>反社会的勢力に対して直接または間接に利益を供与する行為</li>
            <li>公序良俗に違反する行為</li>
            <li>
              歩行中、車両運転中、その他本サービスの利用が不適切な状況または態様において本サービスを利用する行為
            </li>
            <li>その他、当社が不適切と判断する行為</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">12. 反社会的勢力の排除</h2>
          <p className="text-sm leading-relaxed">
            ユーザーは、次の各号のいずれか一にも該当しないことを表明し、かつ将来にわたっても該当しないことを表明し、保証するものとします。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>
              自ら（法人その他の団体にあっては、自らの役員を含みます。）が、暴力団、暴力団員、暴力団員でなくなった時から5年を経過しない者、暴力団準構成員、暴力団関係企業、総会屋、社会運動等標ぼうゴロまたは特殊知能暴力集団等その他これらに準じる者（以下総称して「暴力団員等」といいます。）であること
            </li>
            <li>
              ユーザーが法人その他の団体の場合にあっては、暴力団員等が経営を支配していると認められる関係を有すること
            </li>
            <li>
              ユーザーが法人その他の団体の場合にあっては、暴力団員等が経営に実質的に関与していると認められる関係を有すること
            </li>
            <li>
              自らもしくは第三者の不正の利益を図る目的または第三者に損害を加える目的をもって取引を行うなど、暴力団員等を利用していると認められる関係を有すること
            </li>
            <li>
              暴力団員等に対して資金等を提供し、または便宜を供与するなどの関与をしていると認められる関係を有すること
            </li>
            <li>
              ユーザーが法人その他の団体の場合にあっては、自らの役員または自らの経営に実質的に関与している者が暴力団員等と社会的に非難されるべき関係を有すること
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            ユーザーは、自らまたは第三者を利用して次の各号のいずれか一にでも該当する行為を行わないことを保証するものとします。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>暴力的な要求行為</li>
            <li>法的な責任を超えた不当な要求行為</li>
            <li>取引に関して、脅迫的な言動をし、または暴力を用いる行為</li>
            <li>
              風説を流布し、偽計を用い、または威力を用いて、当社の信用を毀損し、または当社の業務を妨害する行為
            </li>
            <li>その他前各号に準ずる行為</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">13. 利用制限</h2>
          <p className="text-sm leading-relaxed">
            当社は、ユーザーが以下のいずれかに該当する場合には、事前の通知なく、ユーザーに対して、本サービスの全部もしくは一部の利用を制限し、またはユーザーとしての登録を抹消することができるものとします。当社は、本条に基づき当社が行った行為によりユーザーに生じた損害について、一切の責任を負いません。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>本規約のいずれかの条項に違反した場合</li>
            <li>登録事項に虚偽の事実があることが判明した場合</li>
            <li>金銭債務の不履行があった場合</li>
            <li>当社からの連絡に対し、相当の期間が経過しても返答がない場合</li>
            <li>最終のご利用日から相当期間、本サービスのご利用がない場合</li>
            <li>
              反社会的勢力等であるか、反社会的勢力等との何らかの交流若しくは関与を行っていると当社が判断した場合
            </li>
            <li>その他、当社が本サービスの利用を適当でないと判断した場合</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">
            14. 本サービスの提供の停止
          </h2>
          <p className="text-sm leading-relaxed">
            当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。当社は、この場合にユーザーまたは第三者が被ったいかなる不利益または損害についても、一切の責任を負わないものとします。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
            <li>
              地震、落雷、火災、停電、天災またはウィルスの蔓延などの不可抗力により、本サービスの提供が困難となった場合
            </li>
            <li>コンピュータまたは通信回線等が事故により停止した場合</li>
            <li>その他、当社が本サービスの提供が困難と判断した場合</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">15. 退会</h2>
          <p className="text-sm leading-relaxed">
            ユーザーは、当社の定める手続により、利用登録を抹消し、本サービスから退会できるものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">16. 保証の否認</h2>
          <p className="text-sm leading-relaxed">
            当社は、本サービスや本サービスが提供するコンテンツに、システムバグや第三者の権利侵害が含まれないことを保証するものではありません。また、安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性を保証するものでもありません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">17. 免責</h2>
          <p className="text-sm leading-relaxed">
            当社は、本サービスに関してユーザーに生じたあらゆる損害について一切の責任を負いません。ただし、本サービスに関する当社とユーザーとの間の契約（本規約を含みます。）が消費者契約法に定める消費者契約となる場合、この免責規定は適用されません。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            消費者契約に該当する場合であっても、当社は、当社の過失（重過失を除きます。）によってユーザーに生じた損害のうち、ユーザーに直接かつ現実に発生した損害についてのみ賠償責任を負うものとし、また、その賠償額は、本サービスの有償プランに係る過去12か月分の利用料金の合計額または金1万円のいずれか高い方を上限とします。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            本サービスは、以下の外部サービスを利用してサービスを提供しています。これらの外部サービスの障害・仕様変更・提供終了に起因する本サービスの停止・不具合・データ損失等について、当社は責任を負いません。
          </p>
          <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
            <li>
              Cloudflare, Inc.®（
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
              Supabase, Inc.（
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
              OpenAI, L.L.C.（
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
              Anthropic, PBC（
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
              ElevenLabs, Inc.（
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
              PostHog Inc.（
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
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">18. サービス内容の変更</h2>
          <p className="text-sm leading-relaxed">
            当社は、ユーザーに通知することなく、本サービスの内容を変更したり、本サービスの提供を中止、終了することができるものとします。当社は、これによってユーザーに生じた損害について一切の責任を負いません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">19. 利用規約の変更</h2>
          <p className="text-sm leading-relaxed">
            当社は、ユーザーに通知することなく、いつでも本規約を変更することができるものとします。変更後の本規約は、当社ウェブサイトに掲示された時点から効力を生じるものとします。本規約の変更後、本サービスの利用を継続したユーザーは、変更後の本規約に同意したものとみなします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">20. 個人情報の取扱い</h2>
          <p className="text-sm leading-relaxed">
            本サービスの利用によって取得するユーザーの個人情報については、当社の
            <Link
              href="/privacy"
              className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors mx-1"
            >
              プライバシーポリシー
            </Link>
            に従い適切に取り扱うものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">21. 通知または連絡</h2>
          <p className="text-sm leading-relaxed">
            ユーザーと当社との間の通知または連絡は、当社の定める方法によって行うものとします。当社は、ユーザーから、当社が別途定める方式に従った変更届け出がない限り、現在登録されている連絡先が有効なものとみなして当該連絡先へ通知または連絡を行い、これらは、発信時にユーザーへ到達したものとみなします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">22. 権利義務の譲渡</h2>
          <p className="text-sm leading-relaxed">
            ユーザーは、当社の書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利もしくは義務を第三者に譲渡し、または担保に供することはできません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">23. 事業譲渡</h2>
          <p className="text-sm leading-relaxed">
            当社は本サービスにかかる事業を他社に事業譲渡（事業譲渡、会社分割その他事業が移転するあらゆる場合を含みます。）した場合には、当該事業譲渡に伴い利用契約上の地位、本規約に基づく権利および義務ならびにユーザーの情報を当該事業譲渡の譲受人に譲渡することができるものとします。ユーザーは、かかる譲渡につきあらかじめ同意したものとみなします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">24. 適用関係</h2>
          <p className="text-sm leading-relaxed">
            本規約は、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            当社は本サービスに関し、本規約のほか、ご利用にあたってのルールを定めることがあります。これらのルールは、その名称のいかんに関わらず、本規約の一部を構成するものとします。本規約がこれらのルールと矛盾する場合には、これらのルールが優先して適用されるものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">25. 分離可能性</h2>
          <p className="text-sm leading-relaxed">
            本規約のいずれかの条項またはその一部が無効または執行不能と判断された場合であっても、当該判断は他の部分に影響を及ぼさず、本規約の残りの部分は、引き続き有効かつ執行力を有するものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">26. 準拠法・裁判管轄</h2>
          <p className="text-sm leading-relaxed">
            本規約の解釈にあたっては、日本法を準拠法とします。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する地方裁判所を専属的合意管轄とします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">27. 事業者情報</h2>
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

        <div className="mt-12 pt-8 border-t border-[var(--border)] flex gap-6">
          <Link
            href="/privacy"
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
          >
            プライバシーポリシー
          </Link>
          {/* 外部（SNS / 検索）から /terms に直接着地したユーザーのための LP 戻り導線。
              アプリ内の /me から飛んできた場合は別タブで開く設計なので、こちらは別タブ不要。 */}
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
