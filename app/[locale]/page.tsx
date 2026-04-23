export const runtime = "edge";

import LocaleSwitcher from "@/app/components/LocaleSwitcher";
import { OpenAuthButton } from "@/app/components/auth/OpenAuthButton";
import { Cap, Rule } from "@/app/components/chapter";
import ChatDemo from "@/app/components/lp/ChatDemo";
import FeatureTour from "@/app/components/lp/FeatureTour";
import GridBg from "@/app/components/lp/GridBg";
import HeroBg from "@/app/components/lp/HeroBg";
import { InstallPromptButton } from "@/app/components/lp/InstallPromptButton";
import { LpPricingGrid } from "@/app/components/lp/LpPricingGrid";
import { LpThemeToggle } from "@/app/components/lp/LpThemeToggle";
import PulseBg from "@/app/components/lp/PulseBg";
import ScrollReveal from "@/app/components/lp/ScrollReveal";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";

const PROOF_ITEMS = ["speak", "question", "accumulate"] as const;

const STEPS = [
  { num: "01", key: "talk" },
  { num: "02", key: "stack" },
  { num: "03", key: "visualize" },
] as const;

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const tNav = await getTranslations("nav");
  const tHero = await getTranslations("lp.hero");
  const tProof = await getTranslations("lp.proof");
  const tProofItems = await getTranslations("lp.proof.items");
  const tSteps = await getTranslations("lp.steps");
  const tStepsItems = await getTranslations("lp.steps.items");
  const tInsights = await getTranslations("lp.insights");
  const tPricing = await getTranslations("pricing");
  const tCta = await getTranslations("lp.cta");

  return (
    // body が min-h-screen flex flex-col で 100vh 確保済。ここは flex-1 w-full で継承。
    <div className="flex-1 w-full bg-[var(--bg)] text-[var(--fg)] overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-bg-80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="uppercase tracking-[0.32em] text-xs sm:text-sm text-[var(--fg)] hover:text-[var(--fg)] transition-colors"
          >
            MyVoiceLab
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <span
                aria-disabled="true"
                className="uppercase tracking-[0.14em] text-xs font-semibold text-[var(--fg)] cursor-default select-none"
              >
                {tNav("ctaHome")}
              </span>
            ) : (
              <>
                <OpenAuthButton
                  mode="login"
                  className="uppercase tracking-[0.14em] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                >
                  {tNav("ctaLogin")}
                </OpenAuthButton>
                <span
                  aria-disabled="true"
                  className="uppercase tracking-[0.14em] text-xs font-semibold text-[var(--bg)] bg-[var(--fg)] px-4 py-2 cursor-default select-none"
                >
                  {tNav("ctaStart")}
                </span>
              </>
            )}
            <InstallPromptButton
              label={<Download className="w-4 h-4" aria-hidden="true" />}
              ariaLabel={tHero("ctaInstall")}
              posthogPlacement="navbar"
              className="flex items-center justify-center h-[34px] w-[34px] border-[0.5px] border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
            />
            <LpThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
      </nav>

      <main className="pt-14">
        {/* Hero */}
        <section className="relative w-full overflow-hidden">
          <HeroBg />

          <div className="relative z-20 max-w-5xl mx-auto px-6 pt-12 pb-24 sm:pt-16 sm:pb-32">
            <div className="flex flex-col items-start text-left">
              <div className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse"
                />
                <span className="uppercase tracking-[0.32em] text-xs text-[var(--fg-muted)]">
                  {tHero("badge")}
                </span>
              </div>

              <p className="mt-8 text-sm sm:text-base text-[var(--fg-muted)] font-medium tracking-wide">
                {tHero("lead")}
              </p>

              <h1
                className="mt-4 text-5xl sm:text-6xl xl:text-7xl tracking-tight text-[var(--fg)]"
                style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
              >
                {tHero("h1Part1")}
                <br className="sm:hidden" />
                {tHero("h1Part2")}
              </h1>

              <Rule w={64} mv={28} />

              <p className="text-sm sm:text-base text-[var(--fg-subtle)] leading-relaxed">
                {tHero("subCopy1")}
                <br />
                <span className="text-[var(--fg-subtle)]">——</span> {tHero("subCopy2")}
              </p>
            </div>

            <div className="mt-16 mx-auto w-[320px] sm:w-[360px] lg:w-[400px]">
              <ChatDemo />
            </div>
          </div>
        </section>

        {/* Proof (Three shapes) */}
        <section className="relative w-full overflow-hidden bg-elevated-30">
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 sm:py-24">
            <ScrollReveal className="mx-auto max-w-2xl text-center">
              <Cap mb={20}>{tProof("eyebrow")}</Cap>
              <ul className="flex flex-col items-center">
                {PROOF_ITEMS.map((key, i) => (
                  <li key={key} className="flex w-full flex-col items-center">
                    <p
                      className="text-2xl sm:text-3xl lg:text-4xl tracking-tight text-[var(--fg)] leading-[1.3]"
                      style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
                    >
                      {tProofItems(key)}
                    </p>
                    {i < PROOF_ITEMS.length - 1 && <Rule w={40} mv={22} />}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </section>

        {/* How it works */}
        <section className="relative w-full overflow-hidden">
          <GridBg />
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
            <ScrollReveal className="text-center mb-14">
              <Cap mb={16}>{tSteps("eyebrow")}</Cap>
              <h2
                className="text-3xl sm:text-4xl tracking-tight text-[var(--fg)] leading-[1.2]"
                style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
              >
                {tSteps("title")}
              </h2>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-14 sm:gap-10 md:gap-16">
              {STEPS.map((step, i) => (
                <ScrollReveal key={step.num} delay={i * 120}>
                  <div className="flex flex-col items-start text-left">
                    <p
                      className="text-4xl text-[var(--fg-subtle)] leading-none mb-5"
                      style={{
                        fontFamily: MONO_FAMILY,
                        fontWeight: 300,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {step.num}
                    </p>
                    <div
                      aria-hidden
                      className="mb-5"
                      style={{ width: 28, height: 1, background: "var(--fg)", opacity: 0.5 }}
                    />
                    <h3
                      className="text-xl sm:text-2xl tracking-tight text-[var(--fg)] leading-[1.4] mb-4"
                      style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
                    >
                      {tStepsItems(`${step.key}.title`)}
                    </h3>
                    <p className="text-[var(--fg-muted)] text-sm leading-relaxed">
                      {tStepsItems(`${step.key}.desc`)}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* FeatureTour (Actual screens) */}
        <section className="relative w-full overflow-hidden bg-elevated-30">
          <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 sm:py-24">
            <FeatureTour />
          </div>
        </section>

        {/* Insights / Analytics (Coming soon) */}
        <section className="relative w-full overflow-hidden">
          <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 sm:py-24 text-center">
            <ScrollReveal>
              <Cap mb={20}>{tInsights("eyebrow")}</Cap>
              <h2
                className="text-3xl sm:text-4xl tracking-tight text-[var(--fg)] leading-[1.2]"
                style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
              >
                {tInsights("title")}
              </h2>
              <div className="flex justify-center">
                <Rule w={48} mv={22} />
              </div>
              <p className="text-[var(--fg-muted)] text-sm sm:text-base leading-relaxed max-w-lg mx-auto whitespace-pre-line">
                {tInsights("body")}
              </p>
              <p className="mt-6 uppercase tracking-[0.32em] text-xs text-[var(--fg-subtle)]">
                {tInsights("note")}
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Pricing */}
        <section className="relative w-full overflow-hidden bg-elevated-30">
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 sm:py-24">
            <ScrollReveal className="text-center mb-14">
              <Cap mb={16}>{tPricing("chapter.cap")}</Cap>
              <h2
                className="text-3xl sm:text-4xl tracking-tight text-[var(--fg)] leading-[1.2]"
                style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
              >
                {tPricing("chapter.titleLead")}
                <span>{tPricing("chapter.titleAccent")}</span>
                {tPricing("chapter.titleTail")}
              </h2>
              <p className="mt-5 text-[var(--fg-muted)] text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
                {tPricing("chapter.lead")}
              </p>
            </ScrollReveal>
            <LpPricingGrid />
            <p className="mt-8 uppercase tracking-[0.32em] text-xs text-[var(--fg-subtle)] text-center">
              {tPricing("provisionalNote")}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="relative w-full overflow-hidden">
          <PulseBg />

          <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 text-center">
            <ScrollReveal>
              <h2
                className="text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[var(--fg)] leading-[1.2] mb-6"
                style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
              >
                {tCta("titlePart1")}
                <br className="sm:hidden" />
                {tCta("titlePart2")}
              </h2>
              <div className="flex justify-center">
                <Rule w={48} mv={18} />
              </div>
              <p className="text-[var(--fg-muted)] text-lg mb-10 max-w-md mx-auto">
                {tCta("bodyLine1")}
                <br />
                {tCta("bodyLine2")}
              </p>
              <div className="flex items-center justify-center gap-3">
                <span
                  aria-disabled="true"
                  className="inline-block px-10 py-5 bg-[var(--fg)] text-[var(--bg)] font-semibold uppercase tracking-[0.14em] text-xs sm:text-sm cursor-default select-none"
                >
                  {tCta("button")}
                </span>
                <InstallPromptButton
                  label={<Download className="w-5 h-5" aria-hidden="true" />}
                  ariaLabel={tHero("ctaInstall")}
                  posthogPlacement="cta"
                  className="flex items-center justify-center h-[60px] w-[60px] border-[0.5px] border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
                />
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
    </div>
  );
}
