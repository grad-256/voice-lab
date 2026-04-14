export const runtime = "edge";

import AuroraBg from "@/app/components/lp/AuroraBg";
import ChatDemo from "@/app/components/lp/ChatDemo";
import GridBg from "@/app/components/lp/GridBg";
import HeroBg from "@/app/components/lp/HeroBg";
import OrbsBg from "@/app/components/lp/OrbsBg";
import PulseBg from "@/app/components/lp/PulseBg";
import ScrollReveal from "@/app/components/lp/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const SAMPLE_PERSONAS = [
  {
    name: "Yuki",
    initial: "Y",
    style: "カジュアル・励まし上手",
    description: "初心者に寄り添う優しい会話パートナー。失敗を恐れずに話せる安心感がある。",
    color: "from-violet-500 to-indigo-600",
  },
  {
    name: "Alex",
    initial: "A",
    style: "丁寧・ビジネスライク",
    description: "ビジネス英語・面接対策が得意。プロフェッショナルな場面の練習に最適。",
    color: "from-blue-500 to-cyan-600",
  },
  {
    name: "Mia",
    initial: "M",
    style: "明るい・話題豊富",
    description: "旅行・日常会話が大好きなアウトドア派。テンポ良くリラックスして話せる。",
    color: "from-pink-500 to-rose-600",
  },
];

const STEPS = [
  {
    num: "01",
    title: "キャラクターを選ぶ",
    desc: "性格・声・話し方の異なるパートナーから選択。自分に合った相手を見つけよう。",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        />
      </svg>
    ),
  },
  {
    num: "02",
    title: "マイクで話しかける",
    desc: "ボタンを押して話すだけ。文字を打つ必要なし。本物の会話と同じ感覚で練習できる。",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
        />
      </svg>
    ),
  },
  {
    num: "03",
    title: "声で返ってくる",
    desc: "AI が音声で返答。日本語訳もつくから、わからない表現もその場で確認できる。",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
        />
      </svg>
    ),
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
                  href="/login"
                  className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5"
                >
                  ログイン
                </Link>
                <Link
                  href="/app"
                  className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
                >
                  無料で試す
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-14">
        {/* ────── Hero ────── */}
        <section className="relative w-full overflow-hidden">
          {/* 音声波形アニメーション（全幅） */}
          <HeroBg />

          <div className="relative z-20 max-w-5xl mx-auto px-6 pt-24 pb-20">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              {/* 左：コピー */}
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  登録不要・今すぐ体験できます
                </div>

                <h1 className="text-5xl sm:text-6xl font-bold leading-[1.1] tracking-tight">
                  話す練習相手が、
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400">
                    ここにいる。
                  </span>
                </h1>

                <p className="mt-6 text-lg text-gray-400 leading-relaxed max-w-md">
                  人前だと緊張する。練習相手がいない。
                  <br />
                  そんな悩みを、AI が作ったあなた専用の
                  <br />
                  会話パートナーが解決します。
                </p>

                <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Link
                    href="/app"
                    className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all text-base shadow-lg shadow-indigo-900/50 hover:shadow-indigo-900/70 hover:-translate-y-0.5"
                  >
                    無料で話してみる
                  </Link>
                  <Link
                    href="/login"
                    className="px-8 py-3.5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-gray-200 font-medium rounded-xl transition-colors text-base"
                  >
                    ログイン
                  </Link>
                </div>

                <p className="mt-4 text-xs text-gray-600">
                  クレジットカード不要・5往復まで無料体験
                </p>
              </div>

              {/* 右：アニメーションチャット */}
              <div className="flex-shrink-0 w-[272px]">
                <ChatDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ────── How it works ────── */}
        <section className="relative w-full border-t border-gray-800/50 bg-gray-900/30 overflow-hidden">
          <GridBg />
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
            <ScrollReveal className="text-center mb-14">
              <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase mb-4">
                How it works
              </p>
              <h2 className="text-3xl font-bold text-white">3ステップで始められる</h2>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STEPS.map((step, i) => (
                <ScrollReveal key={step.num} delay={i * 120}>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400 mb-4">
                      {step.icon}
                    </div>
                    <p className="text-xs font-bold text-indigo-500 tracking-widest mb-2">
                      {step.num}
                    </p>
                    <h3 className="text-white font-semibold text-lg mb-2">{step.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────── Features ────── */}
        <section className="relative w-full border-t border-gray-800/50 overflow-hidden">
          <OrbsBg />
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
            <ScrollReveal className="text-center mb-14">
              <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase mb-4">
                Features
              </p>
              <h2 className="text-3xl font-bold text-white">MyVoiceLab でできること</h2>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  icon: "🎙️",
                  title: "声で会話",
                  desc: "マイクに話しかけるだけ。相手が声で返してくれるから、本物の会話に近い練習ができる。",
                  gradient: "from-violet-900/40 to-indigo-900/40",
                  border: "border-violet-800/30",
                },
                {
                  icon: "🎭",
                  title: "キャラを選べる",
                  desc: "性格も声も異なるパートナーから選択。日常会話・ビジネス・旅行など、目的に合わせて使い分け。",
                  gradient: "from-indigo-900/40 to-blue-900/40",
                  border: "border-indigo-800/30",
                },
                {
                  icon: "📝",
                  title: "日本語訳つき",
                  desc: "AI の返答には日本語訳が並ぶ。わからない表現もその場で確認できるから、置いてかれない。",
                  gradient: "from-blue-900/40 to-cyan-900/40",
                  border: "border-blue-800/30",
                },
              ].map((f, i) => (
                <ScrollReveal key={f.title} delay={i * 100}>
                  <div
                    className={`bg-gradient-to-br ${f.gradient} border ${f.border} rounded-2xl p-6 h-full`}
                  >
                    <div className="text-3xl mb-4">{f.icon}</div>
                    <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────── Personas ────── */}
        <section className="relative w-full border-t border-gray-800/50 bg-gray-900/30 overflow-hidden">
          <AuroraBg />
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
            <ScrollReveal className="text-center mb-12">
              <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase mb-4">
                Partners
              </p>
              <h2 className="text-3xl font-bold text-white mb-3">こんなキャラと話せます</h2>
              <p className="text-gray-500 text-sm">
                登録すると、自分だけのキャラクターも作成できます
              </p>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {SAMPLE_PERSONAS.map((p, i) => (
                <ScrollReveal key={p.name} delay={i * 100}>
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center text-center hover:border-gray-700 transition-colors h-full">
                    <div
                      className={`w-14 h-14 rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg`}
                    >
                      {p.initial}
                    </div>
                    <h3 className="text-white font-semibold text-lg">{p.name}</h3>
                    <p className="text-xs text-indigo-400 mt-1 mb-3">{p.style}</p>
                    <p className="text-gray-400 text-sm leading-relaxed">{p.description}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────── CTA ────── */}
        <section className="relative w-full border-t border-gray-800/50 overflow-hidden">
          <PulseBg />

          <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 text-center">
            <ScrollReveal>
              <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
                今日から、
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                  話し始めよう。
                </span>
              </h2>
              <p className="text-gray-400 text-lg mb-10 max-w-md mx-auto">
                アカウント不要。5往復まで無料。
                <br />
                まず体験して、続けたくなったら登録を。
              </p>
              <Link
                href="/app"
                className="inline-block px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all text-lg shadow-xl shadow-indigo-900/50 hover:shadow-indigo-900/70 hover:-translate-y-0.5"
              >
                無料で話してみる
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>
    </div>
  );
}
