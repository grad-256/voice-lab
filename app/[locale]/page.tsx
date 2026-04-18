export const runtime = "edge";

import ChatDemo from "@/app/components/lp/ChatDemo";
import FeatureConversationDemo from "@/app/components/lp/FeatureConversationDemo";
import FeatureSummaryDemo from "@/app/components/lp/FeatureSummaryDemo";
import FeatureVoiceDemo from "@/app/components/lp/FeatureVoiceDemo";
import GridBg from "@/app/components/lp/GridBg";
import HeroBg from "@/app/components/lp/HeroBg";
import OrbsBg from "@/app/components/lp/OrbsBg";
import PulseBg from "@/app/components/lp/PulseBg";
import ScrollReveal from "@/app/components/lp/ScrollReveal";
import StepStack from "@/app/components/lp/StepStack";
import StepTalk from "@/app/components/lp/StepTalk";
import StepVisualize from "@/app/components/lp/StepVisualize";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

// 使いかた（How it works）— 話す → 残る → 可視化される の 3 ステップ
const STEPS = [
  {
    num: "01",
    title: "声で話す",
    desc: "マイクを押して、思ったことをそのまま声にする。キーボードは要りません。",
    Demo: StepTalk,
  },
  {
    num: "02",
    title: "会話が残る",
    desc: "AI とのやりとりは自動で記録されていきます。書き留めなくても、忘れない。",
    Demo: StepStack,
  },
  {
    num: "03",
    title: "可視化される",
    desc: "対話が要約されて、あとで読める日記になります。話したことが、見える形に変わっていく。",
    Demo: StepVisualize,
  },
];

// できること（Features）— それぞれの軸の詳細
const FEATURES = [
  {
    title: "声で話す",
    desc: "AI との対話が、ボタンひとつではじまる。振り返りでも、壁打ちでも、雑談でも、声から入る。",
    gradient: "from-violet-900/40 to-indigo-900/40",
    border: "border-violet-800/30",
    Demo: FeatureVoiceDemo,
  },
  {
    title: "会話が残る",
    desc: "話した内容は、読める記録として蓄積。書こうとしてやめるより、声のほうが続く。",
    gradient: "from-indigo-900/40 to-blue-900/40",
    border: "border-indigo-800/30",
    Demo: FeatureConversationDemo,
  },
  {
    title: "可視化される",
    desc: "AI が対話を要約。自分のことばが、あとから読めるかたちに整理されていきます。",
    gradient: "from-blue-900/40 to-cyan-900/40",
    border: "border-blue-800/30",
    Demo: FeatureSummaryDemo,
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // ログイン済みでも LP は閲覧可能。ナビゲーションだけログイン状態に応じて切り替える
  const isAuthenticated = !!user;

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* ────── Navbar ────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight text-white">
            My<span className="text-indigo-400">VoiceLab</span>
          </span>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
              >
                ホームへ
              </Link>
            ) : (
              <>
                <Link
                  href="/app"
                  className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
                >
                  話しはじめる
                </Link>
                <Link
                  href="/login"
                  className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5"
                >
                  ログイン
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-14">
        {/* ────── Hero（Linear 流：中央縦積み・大型 H1・下に大きなビジュアル） ────── */}
        <section className="relative w-full overflow-hidden">
          <HeroBg />

          <div className="relative z-20 max-w-5xl mx-auto px-6 pt-24 pb-24 sm:pt-32 sm:pb-32">
            {/* 二段 Hero：前置き（小・grey）+ メイン H1（大・white → grad）の構造で、
               日本語長文による折返しのバランス崩れを避けつつインパクトを出す（Linear / Anthropic プレスリリース流）。 */}
            <div className="flex flex-col items-start text-left">
              <div className="inline-flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                登録不要・今すぐ体験できます
              </div>

              {/* 前置き（文脈・対象・シーン）— H1 の主役を食わないサイズに抑える */}
              <p className="mt-8 text-sm sm:text-base text-gray-400 font-medium tracking-wide">
                AI と、様々なシチュエーションで。
              </p>

              {/* メイン H1（動詞 2 連で印象を締める） */}
              <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
                話す。
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400">
                  可視化する。
                </span>
              </h1>

              {/* サブコピー（ブランドメッセージ）— 前置きより控えめに */}
              <p className="mt-10 text-sm sm:text-base text-gray-500 leading-relaxed">
                声で生活する、新しいかたち。
                <br />
                <span className="text-gray-600">——</span> 話す練習相手が、ここにいる。
              </p>

              <div className="mt-8 flex flex-row gap-3 w-full sm:w-auto">
                <Link
                  href="/app"
                  className="flex-1 sm:flex-none text-center whitespace-nowrap px-3 sm:px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all text-sm sm:text-base shadow-lg shadow-indigo-900/50 hover:shadow-indigo-900/70 hover:-translate-y-0.5"
                >
                  話しはじめる
                </Link>
                <Link
                  href="/login"
                  className="flex-1 sm:flex-none text-center whitespace-nowrap px-3 sm:px-8 py-3.5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-gray-200 font-medium rounded-xl transition-colors text-sm sm:text-base"
                >
                  ログイン
                </Link>
              </div>

              <p className="mt-3 text-xs sm:text-sm text-gray-400">登録不要・10往復まで無料</p>
            </div>

            {/* ChatDemo は Hero 内で完結させ、途切れを防ぐ（Notion 流の自然な流れ） */}
            <div className="mt-16 mx-auto w-[320px] sm:w-[360px] lg:w-[400px]">
              <ChatDemo />
            </div>
          </div>
        </section>

        {/* ────── 使いかた（How it works） ────── */}
        <section className="relative w-full bg-gray-900/30 overflow-hidden">
          <GridBg />
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
            <ScrollReveal className="text-center mb-14">
              <p className="text-sm font-medium text-indigo-400 mb-3">使いかた</p>
              <h2 className="text-3xl font-bold text-white">話して、残して、可視化する。</h2>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STEPS.map((step, i) => (
                <ScrollReveal key={step.num} delay={i * 120}>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-full max-w-[240px] mb-5">
                      <step.Demo />
                    </div>
                    <p className="text-base font-bold text-indigo-500 tracking-widest mb-2">
                      {step.num}
                    </p>
                    <h3 className="text-white font-semibold text-lg mb-3">{step.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-xs">{step.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────── できること（Features） ────── */}
        <section className="relative w-full overflow-hidden">
          <OrbsBg />
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
            <ScrollReveal className="text-center mb-14">
              <p className="text-sm font-medium text-indigo-400 mb-3">できること</p>
              <h2 className="text-3xl font-bold text-white">
                声で話して、残して、見えるかたちに。
              </h2>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {FEATURES.map((f, i) => (
                <ScrollReveal key={f.title} delay={i * 100}>
                  <div
                    className={`bg-gradient-to-br ${f.gradient} border ${f.border} rounded-2xl p-5 h-full flex flex-col`}
                  >
                    <div className="mb-4">
                      <f.Demo />
                    </div>
                    <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────── CTA ────── */}
        <section className="relative w-full overflow-hidden">
          <PulseBg />

          <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 text-center">
            <ScrollReveal>
              <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
                さあ、
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                  話しはじめよう。
                </span>
              </h2>
              <p className="text-gray-400 text-lg mb-10 max-w-md mx-auto">
                登録不要・10往復まで無料。
                <br />
                まずは、声に出してみる。
              </p>
              <Link
                href="/app"
                className="inline-block px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all text-lg shadow-xl shadow-indigo-900/50 hover:shadow-indigo-900/70 hover:-translate-y-0.5"
              >
                話しはじめる
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>
    </div>
  );
}
