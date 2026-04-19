"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, Calendar, ChevronRight, Mic, Play, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

// スライド識別子。自動切替と手動切替の両方で同じキーを使う。
type SlideId = "recording" | "summary" | "history" | "detail";

const SLIDES: readonly SlideId[] = ["recording", "summary", "history", "detail"] as const;
// embla-carousel-autoplay のデフォルト間隔
const AUTOPLAY_DELAY_MS = 4500;

// スマホ風の丸角フレーム。中身は absolute inset-0 で 9:19 の画面に収める。
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[280px] sm:max-w-[320px]">
      <div className="relative rounded-[2.25rem] border-[8px] border-[var(--border-strong)] bg-[var(--bg)] shadow-2xl shadow-black/30 overflow-hidden aspect-[9/19]">
        {/* スマホのノッチ（上部中央の薄い黒バー） */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-[var(--border-strong)] rounded-b-xl z-10" />
        <div className="absolute inset-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

// 各モックに共通のスマホ画面風ヘッダー。
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
    <div className="flex items-center justify-between pt-8 px-4 pb-3 text-[9px] tracking-wide text-[var(--fg-subtle)]">
      <div className="min-w-[56px]">{left}</div>
      <div className="truncate">{center}</div>
      <div className="min-w-[56px] text-right">{right}</div>
    </div>
  );
}

// 録音中画面の再現モック：ヘッダー + 会話バブル + 呼吸するマイク。
function RecordingMock({
  caption,
  headerBack,
  headerTitle,
  headerFinish,
}: {
  caption: string;
  headerBack: string;
  headerTitle: string;
  headerFinish: string;
}) {
  return (
    <div className="relative w-full h-full flex flex-col">
      <MockHeader
        left={
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={10} strokeWidth={1.5} aria-hidden="true" />
            {headerBack}
          </span>
        }
        center={headerTitle}
        right={headerFinish}
      />

      {/* 会話ログ（assistant/user が交互に積まれる） */}
      <div className="flex-1 flex flex-col gap-2 px-3 overflow-hidden">
        <div className="flex justify-start">
          <div className="max-w-[80%] text-[9px] leading-relaxed px-2.5 py-1.5 rounded-2xl rounded-tl-sm bg-[var(--bg-elevated)] text-[var(--fg)]">
            今日はどんな一日でしたか？
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[80%] text-[9px] leading-relaxed px-2.5 py-1.5 rounded-2xl rounded-tr-sm bg-[var(--accent)] text-white">
            打ち合わせでうまく話せなくて、少し落ち込んだ。
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[80%] text-[9px] leading-relaxed px-2.5 py-1.5 rounded-2xl rounded-tl-sm bg-[var(--bg-elevated)] text-[var(--fg)]">
            具体的にはどのあたりが？
          </div>
        </div>
      </div>

      {/* マイクボタン（呼吸アニメーション）＋キャプション */}
      <div className="flex flex-col items-center gap-2 pb-6">
        <div className="relative w-14 h-14 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)] flex items-center justify-center animate-breathe">
          <Mic
            className="w-5 h-5 text-[var(--accent-strong)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
        <p className="text-[9px] text-[var(--fg-muted)] tracking-wide">{caption}</p>
      </div>
    </div>
  );
}

// 要約ダイアログの再現モック：背景に会話ログをうっすら、上に紙風モーダル。
function SummaryMock({
  headerBack,
  headerTitle,
  heading,
  saveLabel,
  discardLabel,
}: {
  headerBack: string;
  headerTitle: string;
  heading: string;
  saveLabel: string;
  discardLabel: string;
}) {
  return (
    <div className="relative w-full h-full flex flex-col">
      <MockHeader
        left={
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={10} strokeWidth={1.5} aria-hidden="true" />
            {headerBack}
          </span>
        }
        center={headerTitle}
      />

      {/* 背景：会話ログが微かに見える */}
      <div className="flex-1 flex flex-col gap-2 px-3 opacity-30 overflow-hidden">
        <div className="flex justify-start">
          <div className="max-w-[80%] text-[9px] px-2.5 py-1.5 rounded-2xl bg-[var(--bg-elevated)]">
            今日はどうでした？
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[80%] text-[9px] px-2.5 py-1.5 rounded-2xl bg-[var(--accent)] text-white">
            打ち合わせで言いたいことを最後まで伝えられた。
          </div>
        </div>
      </div>

      {/* 要約モーダル（中央） */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 w-full shadow-xl shadow-black/30">
          <p className="text-[8px] tracking-widest-tabular text-[var(--fg-subtle)] mb-1.5 uppercase">
            {heading}
          </p>
          <h4 className="font-semibold text-[var(--fg)] text-[11px] mb-2 leading-snug">
            打ち合わせの振り返り
          </h4>
          <div className="h-px bg-[var(--border)] mb-2" />
          <p className="text-[9px] text-[var(--fg)] leading-relaxed mb-3 whitespace-pre-wrap">
            {`午後の打ち合わせは緊張したけれど、
言いたいことは最後まで伝え切れた。`}
          </p>
          <div className="flex gap-1.5">
            <div className="flex-1 px-2 py-1.5 bg-[var(--accent)] text-white text-[9px] font-medium rounded-md text-center">
              {saveLabel}
            </div>
            <div className="px-2 py-1.5 bg-transparent border border-[var(--border)] text-[var(--fg-muted)] text-[9px] rounded-md">
              {discardLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 履歴画面の再現モック：ヘッダー + 大見出し + カード 1 列グリッド。
function HistoryMock({
  headerBack,
  headerNew,
  title,
}: {
  headerBack: string;
  headerNew: string;
  title: string;
}) {
  const entries = [
    {
      date: "2026-04-18",
      title: "散歩の途中で",
      body: "夕方の公園で、金木犀の香りがした。小さな発見だけれど、書き留めておきたい気持ちになった。",
    },
    {
      date: "2026-04-17",
      title: "朝のコーヒー",
      body: "淹れ方を少し変えてみた。豆の違いで味がこんなに変わるとは思わなかった。",
    },
    {
      date: "2026-04-16",
      title: "仕事の手応え",
      body: "久しぶりに集中して書けた。やっぱり午前中は調子が出る。",
    },
  ];

  return (
    <div className="relative w-full h-full flex flex-col">
      <MockHeader
        left={
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={10} strokeWidth={1.5} aria-hidden="true" />
            {headerBack}
          </span>
        }
        right={
          <span className="inline-flex items-center gap-1 text-[var(--accent)]">
            <Plus size={10} strokeWidth={1.5} aria-hidden="true" />
            {headerNew}
          </span>
        }
      />

      {/* 大見出し */}
      <div className="px-4 pt-2 pb-4">
        <h1 className="text-sm font-semibold text-[var(--fg)] leading-snug tracking-wide">
          {title}
        </h1>
      </div>

      {/* カード 1 列グリッド */}
      <div className="flex-1 overflow-hidden px-4 pb-4 flex flex-col gap-2">
        {entries.map((e) => (
          <div
            key={e.date}
            className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-2.5 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1">
              <Calendar
                size={8}
                strokeWidth={1.5}
                className="text-[var(--fg-subtle)]"
                aria-hidden="true"
              />
              <p className="font-mono-jp text-[7px] text-[var(--fg-subtle)] tracking-widest-tabular uppercase">
                {e.date}
              </p>
            </div>
            <h5 className="font-medium text-[10px] text-[var(--fg)] leading-snug line-clamp-1">
              {e.title}
            </h5>
            <p className="text-[8px] text-[var(--fg-muted)] leading-relaxed line-clamp-2">
              {e.body}
            </p>
            <ChevronRight
              size={8}
              strokeWidth={1.5}
              className="self-end text-[var(--fg-subtle)] -mt-1"
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// 個別日記画面の再現モック：日付 → タイトル → 区切り → 本文 → 再生ボタン。
function DetailMock({
  headerBack,
  playLabel,
}: {
  headerBack: string;
  playLabel: string;
}) {
  return (
    <div className="relative w-full h-full flex flex-col">
      <MockHeader
        left={
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={10} strokeWidth={1.5} aria-hidden="true" />
            {headerBack}
          </span>
        }
      />

      <article className="flex-1 px-4 pt-4 pb-4 overflow-hidden">
        <p className="font-mono-jp text-[8px] text-[var(--fg-subtle)] tracking-widest-tabular uppercase">
          2026-04-18 — SAT
        </p>
        <h4 className="mt-2 text-base font-semibold text-[var(--fg)] leading-tight tracking-wide">
          散歩の途中で
        </h4>
        <div className="mt-3 h-px bg-[var(--border)]" />
        <p className="mt-3 text-[9px] text-[var(--fg)] leading-loose whitespace-pre-wrap">
          {`夕方の公園で、金木犀の香りがした。
しばらく立ち止まって、秋が近いことを
ゆっくり確かめた。
小さな発見だけれど、
こうして書き留めておくと、
あとで読み返すのが楽しみになる。`}
        </p>

        {/* 再生ボタン（「もう一度聞く」） */}
        <div className="mt-4">
          <div className="inline-flex items-center gap-1.5 border border-[var(--border-strong)] text-[var(--fg-muted)] px-2.5 py-1 rounded-md text-[9px] tracking-wide">
            <Play size={10} strokeWidth={1.5} aria-hidden="true" />
            {playLabel}
          </div>
        </div>
      </article>
    </div>
  );
}

// LP「できることツアー」セクション本体。
// embla-carousel でスワイプ・タップ・自動再生を担保する。
export default function FeatureTour() {
  const tTour = useTranslations("lp.tour");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Autoplay プラグイン：ユーザー操作でいったん停止、マウスオーバーでも停止。
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center", skipSnaps: false }, [
    Autoplay({ delay: AUTOPLAY_DELAY_MS, stopOnInteraction: true, stopOnMouseEnter: true }),
  ]);

  // アクティブスライド（キャプション・ドット表示用）を embla API と同期
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
      emblaApi?.scrollTo(idx);
    },
    [emblaApi]
  );

  const activeSlide = SLIDES[selectedIndex] ?? "recording";

  return (
    <div className="flex flex-col gap-8">
      {/* セクション見出し */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-[var(--fg)] mb-3">{tTour("title")}</h2>
        <p className="text-[var(--fg-muted)] text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
          {tTour("subtitle")}
        </p>
      </div>

      {/* embla ビューポート：overflow-hidden + ref */}
      <div className="overflow-hidden" ref={emblaRef}>
        {/* コンテナ：flex で横並び。各スライドは flex-[0_0_100%] */}
        <div className="flex touch-pan-y">
          {SLIDES.map((slide) => (
            <div key={slide} className="flex-[0_0_100%] min-w-0 px-3 py-2">
              <PhoneFrame>
                {slide === "recording" && (
                  <RecordingMock
                    caption={tTour("slides.recording.caption")}
                    headerBack="戻る"
                    headerTitle="声の日記"
                    headerFinish="終わる"
                  />
                )}
                {slide === "summary" && (
                  <SummaryMock
                    headerBack="戻る"
                    headerTitle="声の日記"
                    heading="TODAY'S ENTRY"
                    saveLabel="保存する"
                    discardLabel="捨てる"
                  />
                )}
                {slide === "history" && (
                  <HistoryMock headerBack="戻る" headerNew="新しく話す" title="日記の履歴" />
                )}
                {slide === "detail" && <DetailMock headerBack="戻る" playLabel="もう一度聞く" />}
              </PhoneFrame>
            </div>
          ))}
        </div>
      </div>

      {/* キャプション：アクティブなスライドの説明文 */}
      <p className="text-center text-sm text-[var(--fg-muted)] leading-relaxed max-w-xl mx-auto min-h-[4.5rem] sm:min-h-[3.5rem]">
        {tTour(`slides.${activeSlide}.description`)}
      </p>

      {/* ドットナビ：タップ or クリックでジャンプ。自動再生は stopOnInteraction で止まる */}
      <div className="flex items-center justify-center gap-2.5">
        {SLIDES.map((slide, idx) => {
          const isActive = idx === selectedIndex;
          return (
            <button
              key={slide}
              type="button"
              onClick={() => scrollTo(idx)}
              aria-label={tTour(`slides.${slide}.caption`)}
              aria-current={isActive ? "true" : undefined}
              className={`h-2 rounded-full transition-all ${
                isActive
                  ? "w-8 bg-[var(--accent)]"
                  : "w-2 bg-[var(--border-strong)] hover:bg-[var(--fg-subtle)]"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
