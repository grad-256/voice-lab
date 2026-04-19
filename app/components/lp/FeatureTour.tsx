"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, Calendar, ChevronRight, Mic, Play, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

// スライド識別子。自動切替と手動切替の両方で同じキーを使う。
type SlideId = "recording" | "summary" | "history" | "detail";

const SLIDES: readonly SlideId[] = ["recording", "summary", "history", "detail"] as const;
// embla-carousel-autoplay のスライド切替間隔
const AUTOPLAY_DELAY_MS = 4500;

// messages の `lp.chatDemo.conversation` / `lp.tour.mock.history.entries` を
// そのまま取り出すための型（`t.raw` の戻り値を最小限にキャストする。`any` は使わない）。
type ChatBubble = { role: "assistant" | "user"; text: string };
type HistoryEntry = { date: string; title: string; body: string };

// スマホ風の丸角フレーム。中身は absolute inset-0 で縦長画面に収める。
// モバイル時はカルーセル内で大きく、PC 時は 2×2 グリッドに収まるよう少し抑える。
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[340px] sm:max-w-[320px] md:max-w-[360px]">
      <div className="relative rounded-[2.25rem] border-[8px] border-[var(--border-strong)] bg-[var(--bg)] shadow-2xl shadow-black/30 overflow-hidden aspect-[9/17]">
        {/* スマホのノッチ（上部中央の薄い黒バー） */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-[var(--border-strong)] rounded-b-xl z-10" />
        <div className="absolute inset-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

// 各モックに共通のスマホ画面風ヘッダー。
// left/right が未指定でも min-w スペーサーは残して中央寄せを維持する（レイアウト崩れ防止）。
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
    <div className="flex items-center justify-between pt-8 px-4 pb-3 text-xs tracking-wide text-[var(--fg-subtle)]">
      <div className="min-w-[56px]">{left}</div>
      <div className="truncate">{center}</div>
      <div className="min-w-[56px] text-right">{right}</div>
    </div>
  );
}

// 録音中画面の再現モック：ヘッダー + 会話バブル + 呼吸するマイク。
// bubbles は lp.chatDemo.conversation の先頭 3 件（ja/en 両方に整備済）を利用。
function RecordingMock({
  caption,
  bubbles,
  headerBack,
  headerTitle,
  headerFinish,
}: {
  caption: string;
  bubbles: ChatBubble[];
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
      <div className="flex-1 flex flex-col gap-1.5 px-3 overflow-hidden">
        {bubbles.map((b, i) => (
          <div
            key={`${b.role}-${i}`}
            className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] text-sm leading-relaxed px-2 py-1 rounded-2xl ${
                b.role === "user"
                  ? "bg-[var(--accent)] text-white rounded-tr-sm"
                  : "bg-[var(--bg-elevated)] text-[var(--fg)] rounded-tl-sm"
              }`}
            >
              {b.text}
            </div>
          </div>
        ))}
      </div>

      {/* マイクボタン（呼吸アニメーション）＋キャプション */}
      <div className="flex flex-col items-center gap-1.5 pb-4">
        <div className="relative w-12 h-12 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)] flex items-center justify-center animate-breathe">
          <Mic
            className="w-4 h-4 text-[var(--accent-strong)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
        <p className="text-xs text-[var(--fg-muted)] tracking-wide">{caption}</p>
      </div>
    </div>
  );
}

// 要約ダイアログの再現モック：背景に会話ログをうっすら、上に紙風モーダル。
function SummaryMock({
  bubbles,
  headerBack,
  headerTitle,
  heading,
  summaryTitle,
  summaryBody,
  saveLabel,
  discardLabel,
}: {
  bubbles: ChatBubble[];
  headerBack: string;
  headerTitle: string;
  heading: string;
  summaryTitle: string;
  summaryBody: string;
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
      <div className="flex-1 flex flex-col gap-1.5 px-3 opacity-30 overflow-hidden">
        {bubbles.slice(0, 2).map((b, i) => (
          <div
            key={`${b.role}-${i}`}
            className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] text-sm px-2 py-1 rounded-2xl ${
                b.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-elevated)] text-[var(--fg)]"
              }`}
            >
              {b.text}
            </div>
          </div>
        ))}
      </div>

      {/* 要約モーダル（中央） */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 w-full shadow-xl shadow-black/30">
          <p className="text-sm tracking-widest-tabular text-[var(--fg-subtle)] mb-1.5 uppercase">
            {heading}
          </p>
          <h4 className="font-semibold text-[var(--fg)] text-sm mb-2 leading-snug">
            {summaryTitle}
          </h4>
          <div className="h-px bg-[var(--border)] mb-2" />
          <p className="text-xs text-[var(--fg)] leading-relaxed mb-3 whitespace-pre-wrap">
            {summaryBody}
          </p>
          <div className="flex gap-1.5">
            <div className="flex-1 px-2 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-md text-center">
              {saveLabel}
            </div>
            <div className="px-2 py-1.5 bg-transparent border border-[var(--border)] text-[var(--fg-muted)] text-xs rounded-md">
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
      <div className="px-4 pt-1 pb-2">
        <h1 className="text-sm font-semibold text-[var(--fg)] leading-snug tracking-wide">
          {title}
        </h1>
      </div>

      {/* カード 1 列グリッド */}
      <div className="flex-1 overflow-hidden px-4 pb-4 flex flex-col gap-1.5">
        {entries.map((e) => (
          <div
            key={e.date}
            className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-2 flex flex-col gap-0.5"
          >
            <div className="flex items-center gap-1">
              <Calendar
                size={8}
                strokeWidth={1.5}
                className="text-[var(--fg-subtle)]"
                aria-hidden="true"
              />
              <p className="font-mono-jp text-[10px] text-[var(--fg-subtle)] tracking-widest-tabular uppercase">
                {e.date}
              </p>
            </div>
            <h5 className="font-medium text-xs text-[var(--fg)] leading-snug line-clamp-1">
              {e.title}
            </h5>
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed line-clamp-2">{e.body}</p>
            <ChevronRight
              size={8}
              strokeWidth={1.5}
              className="self-end text-[var(--fg-subtle)] -mt-0.5"
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
            <ArrowLeft size={10} strokeWidth={1.5} aria-hidden="true" />
            {headerBack}
          </span>
        }
      />

      <article className="flex-1 px-4 pt-2 pb-4 overflow-hidden">
        <p className="font-mono-jp text-sm text-[var(--fg-subtle)] tracking-widest-tabular uppercase">
          {dateLine}
        </p>
        <h4 className="mt-1.5 text-sm font-semibold text-[var(--fg)] leading-tight tracking-wide">
          {title}
        </h4>
        <div className="mt-2 h-px bg-[var(--border)]" />
        <p className="mt-2 text-xs text-[var(--fg)] leading-relaxed whitespace-pre-wrap line-clamp-6">
          {body}
        </p>

        {/* 再生ボタン（「もう一度聞く」） */}
        <div className="mt-3">
          <div className="inline-flex items-center gap-1.5 border border-[var(--border-strong)] text-[var(--fg-muted)] px-2.5 py-1 rounded-md text-xs tracking-wide">
            <Play size={10} strokeWidth={1.5} aria-hidden="true" />
            {playLabel}
          </div>
        </div>
      </article>
    </div>
  );
}

// LP「できることツアー」セクション本体。
// embla-carousel でスワイプ・タップ・自動再生を担保し、全コピーは i18n 経由で引く。
export default function FeatureTour() {
  const tTour = useTranslations("lp.tour");
  const tChat = useTranslations("lp.chatDemo");
  const tDiary = useTranslations("diary");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Autoplay プラグイン：ユーザー操作でいったん停止、マウスオーバーでも停止。
  // ドット操作後は autoplay.play() で自動再生を再開する（UX 意図：触っても止まり続けない）。
  // ※ reset() は autoplayActive が false だと no-op（embla-carousel-autoplay v8 の実装）なので play() を使う。
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center", skipSnaps: false }, [
    Autoplay({ delay: AUTOPLAY_DELAY_MS, stopOnInteraction: true, stopOnMouseEnter: true }),
  ]);

  // アクティブスライドを embla API と同期
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
      // 手動ジャンプ後も自動再生を続けたい。stopOnInteraction / stopOnMouseEnter で既に
      // autoplayActive=false になっているケースが通常なので、reset() ではなく play() を呼ぶ
      // （reset は停止中に no-op になる embla-carousel-autoplay v8 の仕様）
      const autoplay = emblaApi.plugins().autoplay;
      autoplay?.play();
    },
    [emblaApi]
  );

  const activeSlide = SLIDES[selectedIndex] ?? "recording";

  // messages から会話バブル・履歴カードを配列で取得（型は最小限にキャスト）
  const conversation = tChat.raw("conversation") as ChatBubble[];
  const historyEntries = tTour.raw("mock.history.entries") as HistoryEntry[];
  // 先頭 3 件のみ使う（録音モックに 3 バブル並べる用）
  const recordingBubbles = conversation.slice(0, 3);

  // スライド ID に対応するモックを描画。モバイル・PC 両方で再利用する。
  const renderMock = (slide: SlideId) => {
    if (slide === "recording") {
      return (
        <RecordingMock
          caption={tTour("slides.recording.caption")}
          bubbles={recordingBubbles}
          headerBack={tDiary("header.back")}
          headerTitle={tDiary("header.title")}
          headerFinish={tDiary("header.finish")}
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
    <div className="flex flex-col gap-8">
      {/* セクション見出し（PC / モバイル共通） */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-[var(--fg)] mb-3">{tTour("title")}</h2>
        <p className="text-[var(--fg-muted)] text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
          {tTour("subtitle")}
        </p>
      </div>

      {/* モバイル（< sm）：embla カルーセル + ドットナビ + アクティブ説明文 */}
      <div className="flex flex-col gap-8 sm:hidden">
        {/* embla ビューポート：overflow-hidden + ref */}
        <div className="overflow-hidden" ref={emblaRef}>
          {/* コンテナ：flex で横並び。touch-pan-y で縦スクロールと両立 */}
          <div className="flex touch-pan-y">
            {SLIDES.map((slide) => (
              <div key={slide} className="flex-[0_0_100%] min-w-0 px-3 py-2">
                <PhoneFrame>{renderMock(slide)}</PhoneFrame>
              </div>
            ))}
          </div>
        </div>

        {/* キャプション：アクティブなスライドの説明文 */}
        <p className="text-center text-sm text-[var(--fg-muted)] leading-relaxed max-w-xl mx-auto min-h-[4.5rem]">
          {tTour(`slides.${activeSlide}.description`)}
        </p>

        {/* ドットナビ：タップ or クリックでジャンプ。autoplay は play() で再開 */}
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

      {/* PC（>= sm）：2×2 グリッド。4 枚同時表示・スワイプ / 自動再生 / ドットなし。
          各フレームの下に caption + description を個別に配置する */}
      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-8 md:gap-12 max-w-5xl mx-auto">
        {SLIDES.map((slide) => (
          <div key={slide} className="flex flex-col items-center gap-4">
            <PhoneFrame>{renderMock(slide)}</PhoneFrame>
            <p className="text-xs font-medium tracking-widest-tabular uppercase text-[var(--accent)]">
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
