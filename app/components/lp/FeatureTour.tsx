"use client";

import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

// スライド識別子。自動切替と手動切替の両方で同じキーを使う。
type SlideId = "recording" | "summary" | "history" | "detail";

const SLIDES: readonly SlideId[] = ["recording", "summary", "history", "detail"] as const;
const AUTO_SWITCH_MS = 4500;
// ユーザーがドットを触った後、何秒経てば自動切替を再開するか
const RESUME_AFTER_PAUSE_MS = 15000;

// 録音中画面の再現モック。呼吸するマイク + 波形 + キャプション。
function RecordingMock({ caption }: { caption: string }) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-6 p-6">
      {/* 周囲の静かな波形（マイクを挟むようにバラバラの高さで呼吸する） */}
      <div className="flex items-end gap-[6px] h-12">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span
            key={i}
            className="w-[4px] rounded-full bg-[var(--accent)]"
            style={{
              height: `${32 + ((i * 19) % 68)}%`,
              animation: `tourWave ${0.9 + (i % 3) * 0.18}s ease-in-out ${i * 0.08}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* 呼吸するマイク円（Quiet Journal の静かな録音状態） */}
      <div className="relative w-20 h-20 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)] flex items-center justify-center animate-breathe">
        <Mic className="w-8 h-8 text-[var(--accent-strong)]" strokeWidth={1.5} />
      </div>

      <p className="text-sm text-[var(--fg-muted)] tracking-wide">{caption}</p>

      <style jsx>{`
        @keyframes tourWave {
          0% { transform: scaleY(0.35); opacity: 0.55; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// 要約ダイアログの再現モック。紙風モーダルに整った本文が乗る。
function SummaryMock() {
  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-6 max-w-sm w-full shadow-lg shadow-black/20">
        <p className="text-[10px] font-medium tracking-widest-tabular text-[var(--fg-subtle)] mb-2">
          TODAY&apos;S ENTRY
        </p>
        <h4 className="font-semibold text-[var(--fg)] text-base mb-3">打ち合わせの振り返り</h4>
        <div className="h-px bg-[var(--border)] mb-3" />
        <p className="text-sm text-[var(--fg)] leading-loose whitespace-pre-wrap">
          {`午後の打ち合わせは緊張したけれど、
言いたいことは最後まで伝え切れた。
次は、もう少しゆっくり話してみたい。`}
        </p>
      </div>
    </div>
  );
}

// 履歴画面の再現モック。日記カードのグリッド。
function HistoryMock() {
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
    {
      date: "2026-04-15",
      title: "雨の日の読書",
      body: "読みかけの本をやっと最後まで読めた。静かな一日だった。",
    },
  ];

  return (
    <div className="w-full h-full p-6 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
        {entries.map((e) => (
          <div
            key={e.date}
            className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 flex flex-col gap-1.5"
          >
            <p className="font-mono-jp text-[10px] text-[var(--fg-subtle)] tracking-widest-tabular">
              {e.date}
            </p>
            <h5 className="font-semibold text-sm text-[var(--fg)]">{e.title}</h5>
            <p className="text-xs text-[var(--fg-muted)] leading-relaxed line-clamp-2">{e.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// 個別日記画面の再現モック。読み物レイアウトで、タイトル + 本文を落ち着いて読ませる。
function DetailMock() {
  return (
    <div className="w-full h-full flex justify-center p-6 overflow-hidden">
      <article className="max-w-md w-full">
        <p className="font-mono-jp text-[11px] text-[var(--fg-subtle)] tracking-widest-tabular mb-2">
          2026-04-18 — SAT
        </p>
        <h4 className="text-2xl font-semibold text-[var(--fg)] leading-tight mb-3">散歩の途中で</h4>
        <div className="h-px bg-[var(--border)] mb-4" />
        <p className="text-sm text-[var(--fg)] leading-loose whitespace-pre-wrap">
          {`夕方の公園で、金木犀の香りがした。
しばらく立ち止まって、秋が近いことを
ゆっくり確かめた。
小さな発見だけれど、
こうして書き留めておくと、
あとで読み返すのが楽しみになる。`}
        </p>
      </article>
    </div>
  );
}

// LP「できることツアー」セクション本体。
// 4 枚のスライドを自動切替で見せ、ドットで手動ジャンプもできる。
// ユーザーが触ったら自動切替は止まる（煩わしさを避ける）。
export default function FeatureTour() {
  const tTour = useTranslations("lp.tour");
  const [activeSlide, setActiveSlide] = useState<SlideId>("recording");
  const [paused, setPaused] = useState(false);
  // OS の動作縮減設定を尊重するため、matchMedia で購読する
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // 動作縮減 ON か、ユーザーが手動操作した直後は自動切替を停止
    if (paused || reduceMotion) return;
    // setInterval + 関数型更新で activeSlide を deps に入れずに済ませる
    const id = setInterval(() => {
      setActiveSlide((current) => {
        const idx = SLIDES.indexOf(current);
        return SLIDES[(idx + 1) % SLIDES.length];
      });
    }, AUTO_SWITCH_MS);
    return () => clearInterval(id);
  }, [paused, reduceMotion]);

  // 一度手動操作しても、一定時間経てば自動切替に戻す（ツアー性を維持）
  useEffect(() => {
    if (!paused) return;
    const id = setTimeout(() => setPaused(false), RESUME_AFTER_PAUSE_MS);
    return () => clearTimeout(id);
  }, [paused]);

  const handleDotClick = (slide: SlideId) => {
    setActiveSlide(slide);
    setPaused(true);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* セクション見出し */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-[var(--fg)] mb-3">{tTour("title")}</h2>
        <p className="text-[var(--fg-muted)] text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
          {tTour("subtitle")}
        </p>
      </div>

      {/* スライド表示領域：絶対配置 + opacity でクロスフェードする */}
      <div className="relative h-[440px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
        {SLIDES.map((slide) => (
          <div
            key={slide}
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              activeSlide === slide ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-hidden={activeSlide !== slide}
          >
            {slide === "recording" && <RecordingMock caption={tTour("slides.recording.caption")} />}
            {slide === "summary" && <SummaryMock />}
            {slide === "history" && <HistoryMock />}
            {slide === "detail" && <DetailMock />}
          </div>
        ))}
      </div>

      {/* キャプション：アクティブなスライドの説明文 */}
      <p className="text-center text-sm text-[var(--fg-muted)] leading-relaxed max-w-xl mx-auto min-h-[4.5rem] sm:min-h-[3.5rem]">
        {tTour(`slides.${activeSlide}.description`)}
      </p>

      {/* ドットナビ：クリックでジャンプ、自動切替は停止 */}
      <div className="flex items-center justify-center gap-2.5">
        {SLIDES.map((slide) => {
          const isActive = activeSlide === slide;
          return (
            <button
              key={slide}
              type="button"
              onClick={() => handleDotClick(slide)}
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
