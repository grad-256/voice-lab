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
import { getTranslations } from "next-intl/server";

// 使いかた（How it works）— 話す → 残る → 可視化される の 3 ステップ
const STEPS = [
  { num: "01", key: "talk", Demo: StepTalk },
  { num: "02", key: "stack", Demo: StepStack },
  { num: "03", key: "visualize", Demo: StepVisualize },
] as const;

// できること（Features）— それぞれの軸の詳細。
// Quiet Journal 路線では色で差別化せず、共通のカードトーンに揃える。
const FEATURES = [
  { key: "voice", Demo: FeatureVoiceDemo },
  { key: "conversation", Demo: FeatureConversationDemo },
  { key: "summary", Demo: FeatureSummaryDemo },
] as const;

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // ログイン済みでも LP は閲覧可能。ナビゲーションだけログイン状態に応じて切り替える
  const isAuthenticated = !!user;

  const tNav = await getTranslations("nav");
  const tHero = await getTranslations("lp.hero");
  const tSteps = await getTranslations("lp.steps");
  const tStepsItems = await getTranslations("lp.steps.items");
  const tFeatures = await getTranslations("lp.features");
  const tFeaturesItems = await getTranslations("lp.features.items");
  const tCta = await getTranslations("lp.cta");
  const tBridges = await getTranslations("lp.bridges");

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] overflow-x-hidden">
      {/* ────── Navbar ────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight text-[var(--fg)]">
            My<span className="text-[var(--accent)]">VoiceLab</span>
          </span>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white px-4 py-1.5 rounded-lg transition-colors"
              >
                {tNav("ctaHome")}
              </Link>
            ) : (
              <>
                <Link
                  href="/app"
                  className="text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white px-4 py-1.5 rounded-lg transition-colors"
                >
                  {tNav("ctaStart")}
                </Link>
                <Link
                  href="/login"
                  className="text-sm text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors px-3 py-1.5"
                >
                  {tNav("ctaLogin")}
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
              <div className="inline-flex items-center gap-2 bg-[var(--accent-subtle)] border border-[var(--border-strong)] text-[var(--fg-muted)] text-xs font-medium px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                {tHero("badge")}
              </div>

              {/* 前置き（文脈・対象・シーン）— H1 の主役を食わないサイズに抑える */}
              <p className="mt-8 text-sm sm:text-base text-[var(--fg-muted)] font-medium tracking-wide">
                {tHero("lead")}
              </p>

              {/* メイン H1（動詞 2 連で印象を締める）— Quiet Journal 路線では単色に統一して紙の落ち着きを出す。
                 改行は <br /> で明示し、モバイルでも必ず 2 行で表示されるようにする（whitespace-nowrap は不使用）。 */}
              <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-[var(--fg)]">
                {tHero("h1Part1")}
                <br />
                <span className="text-[var(--fg)]">{tHero("h1Part2")}</span>
              </h1>

              {/* サブコピー（ブランドメッセージ）— 前置きより控えめに */}
              <p className="mt-10 text-sm sm:text-base text-[var(--fg-subtle)] leading-relaxed">
                {tHero("subCopy1")}
                <br />
                <span className="text-[var(--fg-subtle)]">——</span> {tHero("subCopy2")}
              </p>

              <div className="mt-8 flex flex-row gap-3 w-full sm:w-auto">
                <Link
                  href="/app"
                  className="flex-1 sm:flex-none text-center whitespace-nowrap px-3 sm:px-8 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white font-semibold rounded-xl transition-all text-sm sm:text-base shadow-lg shadow-black/30 hover:-translate-y-0.5"
                >
                  {tHero("ctaStart")}
                </Link>
                <Link
                  href="/login"
                  className="flex-1 sm:flex-none text-center whitespace-nowrap px-3 sm:px-8 py-3.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)]/80 border border-[var(--border-strong)] text-[var(--fg-muted)] font-medium rounded-xl transition-colors text-sm sm:text-base"
                >
                  {tHero("ctaLogin")}
                </Link>
              </div>

              <p className="mt-3 text-xs sm:text-sm text-[var(--fg-subtle)]">{tHero("note")}</p>
            </div>

            {/* ChatDemo は Hero 内で完結させ、途切れを防ぐ（Notion 流の自然な流れ） */}
            <div className="mt-16 mx-auto w-[320px] sm:w-[360px] lg:w-[400px]">
              <ChatDemo />
            </div>
          </div>
        </section>

        {/* ────── つなぎ（Hero → Steps）— 次セクションへの橋渡し文 ────── */}
        <ScrollReveal>
          <div className="max-w-2xl mx-auto px-6 py-10 sm:py-16 text-center">
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
              {tBridges("afterHero")}
            </p>
          </div>
        </ScrollReveal>

        {/* ────── 使いかた（How it works） ────── */}
        <section className="relative w-full bg-[var(--bg-elevated)]/30 overflow-hidden">
          <GridBg />
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
            <ScrollReveal className="text-center mb-14">
              <p className="text-sm font-medium text-[var(--accent)] mb-3">{tSteps("eyebrow")}</p>
              <h2 className="text-3xl font-bold text-[var(--fg)]">{tSteps("title")}</h2>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STEPS.map((step, i) => (
                <ScrollReveal key={step.num} delay={i * 120}>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-full max-w-[240px] mb-5">
                      <step.Demo />
                    </div>
                    <p className="text-base font-bold text-[var(--fg-subtle)] tracking-widest mb-2">
                      {step.num}
                    </p>
                    <h3 className="text-[var(--fg)] font-semibold text-lg mb-3">
                      {tStepsItems(`${step.key}.title`)}
                    </h3>
                    <p className="text-[var(--fg-muted)] text-sm leading-relaxed max-w-xs">
                      {tStepsItems(`${step.key}.desc`)}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────── つなぎ（Steps → Features）— 次セクションへの橋渡し文 ────── */}
        <ScrollReveal>
          <div className="max-w-2xl mx-auto px-6 py-10 sm:py-16 text-center">
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
              {tBridges("afterSteps")}
            </p>
          </div>
        </ScrollReveal>

        {/* ────── できること（Features） ────── */}
        <section className="relative w-full overflow-hidden">
          <OrbsBg />
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
            <ScrollReveal className="text-center mb-14">
              <p className="text-sm font-medium text-[var(--accent)] mb-3">
                {tFeatures("eyebrow")}
              </p>
              <h2 className="text-3xl font-bold text-[var(--fg)]">{tFeatures("title")}</h2>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {FEATURES.map((f, i) => (
                <ScrollReveal key={f.key} delay={i * 100}>
                  <div className="bg-[var(--bg-elevated)]/70 border border-[var(--border)] rounded-2xl p-5 h-full flex flex-col">
                    <div className="mb-4">
                      <f.Demo />
                    </div>
                    <h3 className="text-[var(--fg)] font-semibold text-lg mb-2">
                      {tFeaturesItems(`${f.key}.title`)}
                    </h3>
                    <p className="text-[var(--fg-muted)] text-sm leading-relaxed">
                      {tFeaturesItems(`${f.key}.desc`)}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────── つなぎ（Features → CTA）— 次セクションへの橋渡し文 ────── */}
        <ScrollReveal>
          <div className="max-w-2xl mx-auto px-6 py-10 sm:py-16 text-center">
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
              {tBridges("afterFeatures")}
            </p>
          </div>
        </ScrollReveal>

        {/* ────── CTA ────── */}
        <section className="relative w-full overflow-hidden">
          <PulseBg />

          <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 text-center">
            <ScrollReveal>
              {/* CTA 見出しもモバイルで必ず 2 行になるよう <br /> で明示改行 */}
              <h2 className="text-4xl sm:text-5xl font-bold text-[var(--fg)] leading-tight mb-6">
                {tCta("titlePart1")}
                <br />
                <span className="text-[var(--fg)]">{tCta("titlePart2")}</span>
              </h2>
              <p className="text-[var(--fg-muted)] text-lg mb-10 max-w-md mx-auto">
                {tCta("bodyLine1")}
                <br />
                {tCta("bodyLine2")}
              </p>
              <Link
                href="/app"
                className="inline-block px-10 py-4 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white font-semibold rounded-xl transition-all text-lg shadow-xl shadow-black/30 hover:-translate-y-0.5"
              >
                {tCta("button")}
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>
    </div>
  );
}
