"use client";

import { Cap } from "@/app/components/chapter";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, Mic, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type SlideId = "recording" | "summary" | "history" | "detail";

const SLIDES: readonly SlideId[] = ["recording", "summary", "history", "detail"] as const;
const AUTOPLAY_DELAY_MS = 4500;

type ChatBubble = { role: "assistant" | "user"; text: string };
type HistoryEntry = { date: string; title: string; body: string };

// 電話枠：14px 角丸 + 0.5px 罫線、上下に status / home シグナル。
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[340px] sm:max-w-[320px] md:max-w-[360px]">
      <div
        className="relative overflow-hidden aspect-[9/17] shadow-theme-md"
        style={{
          background: "var(--bg)",
          border: "0.5px solid var(--border-strong)",
          borderRadius: 14,
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-5 px-4 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)] z-10"
          style={{ fontFamily: MONO_FAMILY }}
        >
          <span>9:41</span>
          <span className="relative inline-block w-[12px] h-[6px] border-[0.5px] border-[var(--fg-muted)]">
            <span
              aria-hidden
              className="absolute"
              style={{
                top: 1,
                left: 1,
                right: 1,
                bottom: 1,
                background: "var(--fg-muted)",
              }}
            />
          </span>
        </div>

        <div className="absolute inset-0 overflow-hidden pt-5">{children}</div>

        <div className="absolute left-1/2 bottom-[5px] -translate-x-1/2 z-10">
          <span
            aria-hidden
            className="block"
            style={{
              width: 56,
              height: 3,
              borderRadius: 2,
              background: "var(--fg)",
              opacity: 0.3,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MockHeader({
  left,
  center,
  right,
}: {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 pt-2 pb-3 text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)]">
      <div className="min-w-[40px]">{left}</div>
      <div className="truncate">{center}</div>
      <div className="min-w-[40px] text-right">{right}</div>
    </div>
  );
}

function RecordingMock({
  caption,
  bubbles,
  headerBack,
  headerTitle,
  headerFinish,
  liveLabel,
  quietVoice,
}: {
  caption?: string;
  bubbles: ChatBubble[];
  headerBack: string;
  headerTitle: string;
  headerFinish: string;
  liveLabel: string;
  quietVoice: string;
}) {
  return (
    <div className="relative w-full h-full flex flex-col">
      <MockHeader
        left={
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={9} strokeWidth={1.5} aria-hidden="true" />
            {headerBack}
          </span>
        }
        center={headerTitle}
        right={headerFinish}
      />

      <div
        className="flex-1 overflow-hidden px-4 pt-2 pb-3 space-y-3"
        style={{ borderTop: "0.5px solid var(--border)" }}
      >
        <div className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)]">{liveLabel}</div>

        {bubbles.map((b, i) =>
          b.role === "user" ? (
            <div
              key={`${b.role}-${i}`}
              className="text-sm leading-[1.6]"
              style={{ fontFamily: SERIF_FAMILY, color: "var(--fg)" }}
            >
              {b.text}
            </div>
          ) : (
            <div
              key={`${b.role}-${i}`}
              style={{ borderLeft: "1.5px solid var(--fg)", paddingLeft: 10 }}
            >
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)] mb-[2px]">
                {quietVoice}
              </div>
              <div
                className="text-xs leading-[1.5]"
                style={{ fontFamily: SERIF_FAMILY, color: "var(--fg)" }}
              >
                {b.text}
              </div>
            </div>
          )
        )}
      </div>

      <div className="flex flex-col items-center gap-2 pb-6">
        <div
          className="relative w-11 h-11 rounded-full flex items-center justify-center animate-breathe"
          style={{
            background: "transparent",
            border: "0.5px solid var(--fg)",
          }}
        >
          <Mic size={16} strokeWidth={1.5} color="var(--fg)" aria-hidden="true" />
        </div>
        {caption && (
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)]">{caption}</p>
        )}
      </div>
    </div>
  );
}

function SummaryMock({
  bubbles,
  headerBack,
  headerTitle,
  heading,
  summaryTitle,
  summaryBody,
  saveLabel,
  discardLabel,
  quietVoice,
}: {
  bubbles: ChatBubble[];
  headerBack: string;
  headerTitle: string;
  heading: string;
  summaryTitle: string;
  summaryBody: string;
  saveLabel: string;
  discardLabel: string;
  quietVoice: string;
}) {
  return (
    <div className="relative w-full h-full flex flex-col">
      <MockHeader
        left={
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={9} strokeWidth={1.5} aria-hidden="true" />
            {headerBack}
          </span>
        }
        center={headerTitle}
      />

      <div
        className="flex-1 overflow-hidden px-4 pt-2 pb-3 space-y-3 opacity-35"
        style={{ borderTop: "0.5px solid var(--border)" }}
      >
        {bubbles.slice(0, 2).map((b, i) =>
          b.role === "user" ? (
            <div
              key={`${b.role}-${i}`}
              className="text-xs leading-[1.6]"
              style={{ fontFamily: SERIF_FAMILY, color: "var(--fg)" }}
            >
              {b.text}
            </div>
          ) : (
            <div
              key={`${b.role}-${i}`}
              style={{ borderLeft: "1.5px solid var(--fg)", paddingLeft: 8 }}
            >
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)] mb-[2px]">
                {quietVoice}
              </div>
              <div
                className="text-xs leading-[1.5]"
                style={{ fontFamily: SERIF_FAMILY, color: "var(--fg)" }}
              >
                {b.text}
              </div>
            </div>
          )
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-5">
        <div
          className="w-full p-4"
          style={{
            background: "var(--bg)",
            border: "0.5px solid var(--fg)",
          }}
        >
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)] mb-2">
            {heading}
          </p>
          <h4
            className="text-sm leading-[1.3] mb-2"
            style={{ fontFamily: SERIF_FAMILY, color: "var(--fg)", fontWeight: 400 }}
          >
            {summaryTitle}
          </h4>
          <div
            aria-hidden
            style={{ width: 28, height: 1, background: "var(--fg)", opacity: 0.5 }}
          />
          <p
            className="mt-2 text-xs leading-[1.6] mb-3 whitespace-pre-wrap"
            style={{ fontFamily: SERIF_FAMILY, color: "var(--fg-muted)" }}
          >
            {summaryBody}
          </p>
          <div className="flex gap-2">
            <div
              className="flex-1 text-center text-xs uppercase tracking-[0.14em] font-semibold py-2"
              style={{ background: "var(--fg)", color: "var(--bg)" }}
            >
              {saveLabel}
            </div>
            <div
              className="text-xs uppercase tracking-[0.14em] px-4 py-2"
              style={{
                background: "transparent",
                border: "0.5px solid var(--fg)",
                color: "var(--fg)",
              }}
            >
              {discardLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryMock({
  entries,
  headerBack,
  headerNew,
  title,
}: {
  entries: HistoryEntry[];
  headerBack: string;
  headerNew: string;
  title: string;
}) {
  return (
    <div className="relative w-full h-full flex flex-col">
      <MockHeader
        left={
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={9} strokeWidth={1.5} aria-hidden="true" />
            {headerBack}
          </span>
        }
        right={<span>{headerNew}</span>}
      />

      <div className="px-4 pt-3 pb-2" style={{ borderTop: "0.5px solid var(--border)" }}>
        <h1
          className="text-base leading-[1.2]"
          style={{ fontFamily: SERIF_FAMILY, color: "var(--fg)", fontWeight: 400 }}
        >
          {title}
        </h1>
      </div>

      <div className="flex-1 overflow-hidden px-4 pb-4 flex flex-col">
        {entries.map((e, idx) => (
          <div
            key={e.date}
            className="py-2 flex flex-col gap-[3px]"
            style={{
              borderTop:
                idx === 0 ? "0.5px solid var(--border-strong)" : "0.5px solid var(--border)",
            }}
          >
            <p
              className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)]"
              style={{ fontFamily: MONO_FAMILY }}
            >
              {e.date}
            </p>
            <h5
              className="text-xs leading-[1.3] line-clamp-1"
              style={{ fontFamily: SERIF_FAMILY, color: "var(--fg)", fontWeight: 400 }}
            >
              {e.title}
            </h5>
            <p
              className="text-xs leading-[1.55] line-clamp-2"
              style={{ fontFamily: SERIF_FAMILY, color: "var(--fg-muted)" }}
            >
              {e.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailMock({
  headerBack,
  dateLine,
  title,
  body,
  playLabel,
}: {
  headerBack: string;
  dateLine: string;
  title: string;
  body: string;
  playLabel: string;
}) {
  return (
    <div className="relative w-full h-full flex flex-col">
      <MockHeader
        left={
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={9} strokeWidth={1.5} aria-hidden="true" />
            {headerBack}
          </span>
        }
      />

      <article
        className="flex-1 px-5 pt-3 pb-4 overflow-hidden"
        style={{ borderTop: "0.5px solid var(--border)" }}
      >
        <p
          className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)]"
          style={{ fontFamily: MONO_FAMILY }}
        >
          {dateLine}
        </p>
        <h4
          className="mt-2 text-base leading-[1.2]"
          style={{ fontFamily: SERIF_FAMILY, color: "var(--fg)", fontWeight: 400 }}
        >
          {title}
        </h4>
        <div
          aria-hidden
          className="mt-3 mb-3"
          style={{ width: 36, height: 1, background: "var(--fg)", opacity: 0.5 }}
        />
        <p
          className="text-xs leading-[1.7] whitespace-pre-wrap line-clamp-6"
          style={{ fontFamily: SERIF_FAMILY, color: "var(--fg)" }}
        >
          {body}
        </p>

        <div className="mt-4">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-[0.14em]"
            style={{
              border: "0.5px solid var(--fg)",
              color: "var(--fg)",
            }}
          >
            <Play size={9} strokeWidth={1.5} aria-hidden="true" />
            {playLabel}
          </div>
        </div>
      </article>
    </div>
  );
}

export default function FeatureTour() {
  const tTour = useTranslations("lp.tour");
  const tChat = useTranslations("lp.chatDemo");
  const tDiary = useTranslations("diary");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center", skipSnaps: false }, [
    Autoplay({ delay: AUTOPLAY_DELAY_MS, stopOnInteraction: true, stopOnMouseEnter: true }),
  ]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollTo = useCallback(
    (idx: number) => {
      if (!emblaApi) return;
      emblaApi.scrollTo(idx);
      const autoplay = emblaApi.plugins().autoplay;
      autoplay?.play();
    },
    [emblaApi]
  );

  const activeSlide = SLIDES[selectedIndex] ?? "recording";

  const conversation = tChat.raw("conversation") as ChatBubble[];
  const historyEntries = tTour.raw("mock.history.entries") as HistoryEntry[];
  const recordingBubbles = conversation.slice(0, 3);

  const renderMock = (slide: SlideId, showInnerCaption = true) => {
    if (slide === "recording") {
      return (
        <RecordingMock
          caption={showInnerCaption ? tTour("slides.recording.caption") : undefined}
          bubbles={recordingBubbles}
          headerBack={tDiary("header.back")}
          headerTitle={tDiary("header.title")}
          headerFinish={tDiary("header.finish")}
          liveLabel={tChat("liveLabel")}
          quietVoice={tChat("quietVoice")}
        />
      );
    }
    if (slide === "summary") {
      return (
        <SummaryMock
          bubbles={recordingBubbles}
          headerBack={tDiary("header.back")}
          headerTitle={tDiary("header.title")}
          heading={tDiary("summary.heading")}
          summaryTitle={tTour("mock.summary.title")}
          summaryBody={tTour("mock.summary.body")}
          saveLabel={tDiary("summary.save")}
          discardLabel={tDiary("summary.discard")}
          quietVoice={tChat("quietVoice")}
        />
      );
    }
    if (slide === "history") {
      return (
        <HistoryMock
          entries={historyEntries}
          headerBack={tDiary("history.back")}
          headerNew={tDiary("history.new")}
          title={tDiary("history.title")}
        />
      );
    }
    return (
      <DetailMock
        headerBack={tDiary("detail.back")}
        dateLine={tTour("mock.detail.dateLine")}
        title={tTour("mock.detail.title")}
        body={tTour("mock.detail.body")}
        playLabel={tDiary("detail.play")}
      />
    );
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="text-center">
        <Cap mb={16}>{tTour("eyebrow")}</Cap>
        <h2
          className="text-3xl sm:text-4xl leading-[1.15] tracking-[-0.02em]"
          style={{ fontFamily: SERIF_FAMILY, fontWeight: 400, color: "var(--fg)" }}
        >
          {tTour("title")}
        </h2>
        <p className="mt-5 text-[var(--fg-muted)] text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
          {tTour("subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:hidden">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {SLIDES.map((slide) => (
              <div key={slide} className="flex-[0_0_100%] min-w-0 px-3 py-2">
                <PhoneFrame>{renderMock(slide)}</PhoneFrame>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-[var(--fg-muted)] leading-relaxed max-w-xl mx-auto min-h-[4.5rem]">
          {tTour(`slides.${activeSlide}.description`)}
        </p>

        <div className="flex items-center justify-center gap-2">
          {SLIDES.map((slide, idx) => {
            const isActive = idx === selectedIndex;
            return (
              <button
                key={slide}
                type="button"
                onClick={() => scrollTo(idx)}
                aria-label={tTour(`slides.${slide}.caption`)}
                aria-current={isActive ? "true" : undefined}
                className="transition-all"
                style={{
                  width: isActive ? 28 : 10,
                  height: 1,
                  background: isActive ? "var(--fg)" : "var(--border-strong)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-10 md:gap-12 max-w-5xl mx-auto">
        {SLIDES.map((slide) => (
          <div key={slide} className="flex flex-col items-center gap-5">
            <PhoneFrame>{renderMock(slide, false)}</PhoneFrame>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--fg-muted)]">
              {tTour(`slides.${slide}.caption`)}
            </p>
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed text-center max-w-xs">
              {tTour(`slides.${slide}.description`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
