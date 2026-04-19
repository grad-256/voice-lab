"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { Link, useRouter } from "@/i18n/routing";
import {
  GUEST_LIMIT,
  getGuestCount,
  incrementGuestCount,
  isGuestLimitReached,
} from "@/lib/guestUsage";
import { mapGetUserMediaError, pickBrowserMimeType } from "@/lib/recordingMime";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, ArrowRight, Mic } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  text: string;
};

type Status = "idle" | "recording" | "processing" | "speaking";

type AuthStatus = "unknown" | "guest" | "authed";

type Language = "ja" | "en" | "mixed";

type SummaryResult = {
  title: string;
  summary: string;
  language: Language;
};

const MIN_RECORDING_MS = 1500;

// 「終わり」音声コマンド候補。Whisper 出力を小文字化・句読点除去した上で、
// 単独発話（またはこれ + 軽い語尾）のときだけマッチさせる。
const END_KEYWORDS = [
  "終わり",
  "終わる",
  "終了",
  "おしまい",
  "おわり",
  "bye",
  "goodbye",
  "end",
  "finish",
  "that's all",
] as const;

// 終了コマンドの末尾に付く軽い語尾。「かな」は思案形なので除外。
const END_TAIL_WORDS = ["です", "だよ", "だね", "ね", "よ"] as const;

function uid() {
  return Math.random().toString(36).slice(2);
}

// 発話全体が終了コマンドとみなせるか。単独発話以外は誤検知の元なので弾く。
function isEndCommand(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[。、，．,.!?！？\s　]/g, "")
    .trim();
  if (!normalized) return false;

  for (const kw of END_KEYWORDS) {
    const k = kw.toLowerCase().replace(/\s/g, "");
    if (normalized === k) return true;
    for (const t of END_TAIL_WORDS) {
      if (normalized === `${k}${t}`) return true;
    }
  }
  return false;
}

export default function DiaryPage() {
  const router = useRouter();
  // UI ロケール（ja/en）。Whisper の language ヒントと chat ルートのシステムプロンプトへ渡す。
  const locale = useLocale();
  const t = useTranslations("diary");

  const [authStatus, setAuthStatus] = useState<AuthStatus>("unknown");
  const [isStarted, setIsStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [pastSummaries, setPastSummaries] = useState<string[]>([]);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const isGuest = authStatus === "guest";

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processAudioRef = useRef<(() => Promise<void>) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // アンマウント後の state 更新・音声再生継続を防ぐための参照
  const mountedRef = useRef(true);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  // 「はじめる」連打による多重 assistant-first 起動を防ぐ
  const startingRef = useRef(false);
  // 終了フロー（要約生成 + 保存）の多重起動ガード
  const finalizingRef = useRef(false);

  // アンマウント時に state 更新を止め、再生中音声を停止する
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // 認証状態
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!mountedRef.current) return;
      setAuthStatus(data.user ? "authed" : "guest");
    });
    setGuestCount(getGuestCount());
  }, []);

  // ログイン済のとき、過去日記 3 件の要約を取得して文脈継承に使う
  useEffect(() => {
    if (authStatus !== "authed") return;
    let aborted = false;
    fetch("/api/diary?limit=3")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: { summary?: string }[] } | null) => {
        if (aborted || !mountedRef.current || !data?.items) return;
        const summaries = data.items
          .map((i) => (typeof i.summary === "string" ? i.summary : null))
          .filter((s): s is string => s !== null);
        setPastSummaries(summaries);
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, [authStatus]);

  // 会話が進むたびに末尾までスクロール
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length で意図的にトリガー
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ユーザー発話が 1 件以上あり、まだ保存完了していない間は離脱警告を出す。
  // 要約プレビュー中はユーザーが「保存する」を押す前なので、むしろ警告が必要。
  useEffect(() => {
    const hasUserContent = messages.some((m) => m.role === "user");
    const alreadySaved = saveStatus === "saved";
    if (!hasUserContent || alreadySaved) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [messages, saveStatus]);

  // iOS Safari 対応：AudioContext を warm up する共通ヘルパー。
  // handleStart（AI 挨拶の再生前）と startRecording（直接録音が発火するケースの保険）
  // の両方から呼ばれる。片方を消すと片方のパスで自動再生がブロックされるので両方必要。
  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AC();
    } catch {}
  }, []);

  // ElevenLabs で TTS 再生
  const playReply = useCallback(async (text: string) => {
    try {
      if (mountedRef.current) setStatus("speaking");
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 日記要約は長文・じっくり聞き返せる用途のため、表現力重視の eleven_v3 を使う
        body: JSON.stringify({ text, modelId: "eleven_v3" }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        setStatus("idle");
        return;
      }
      const blob = await res.blob();
      if (!mountedRef.current) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
      if (currentAudioRef.current === audio) currentAudioRef.current = null;
    } catch (err) {
      console.error("speak error:", err);
    } finally {
      if (mountedRef.current) setStatus("idle");
    }
  }, []);

  // 「はじめる」ボタン押下で AI の最初の発話（assistant-first）を取得・再生する。
  const handleStart = useCallback(async () => {
    if (startingRef.current) return;

    if (isGuest && isGuestLimitReached()) {
      setShowLimitModal(true);
      return;
    }

    startingRef.current = true;
    setIsStarted(true);
    setStatus("processing");
    setErrorMsg(null);
    ensureAudioContext();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [],
          mode: "diary",
          assistantFirst: true,
          pastSummaries,
          locale,
        }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        setStatus("idle");
        setErrorMsg(t("errors.bootstrap"));
        setIsStarted(false);
        return;
      }
      const data = (await res.json()) as { text?: string; error?: string };
      if (!mountedRef.current) return;
      const text = data.text ?? "";
      if (!text) {
        setStatus("idle");
        setIsStarted(false);
        return;
      }
      setMessages([{ id: uid(), role: "assistant", text }]);
      await playReply(text);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("bootstrap error:", err);
      setStatus("idle");
      setErrorMsg(t("errors.bootstrapShort"));
      setIsStarted(false);
    } finally {
      startingRef.current = false;
    }
  }, [isGuest, playReply, ensureAudioContext, pastSummaries, locale, t]);

  // 会話終了フロー：要約を生成してプレビュー。ユーザー発話ゼロなら破棄扱い。
  const handleFinish = useCallback(async () => {
    if (finalizingRef.current) return;
    const currentMessages = messages;
    const userTurns = currentMessages.filter((m) => m.role === "user").length;
    if (userTurns === 0) {
      router.push("/app");
      return;
    }
    finalizingRef.current = true;
    setStatus("processing");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: currentMessages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(
          err.error === "SERVICE_QUOTA_EXCEEDED" ? t("errors.quotaExceeded") : t("errors.summarize")
        );
        setStatus("idle");
        return;
      }
      const data = (await res.json()) as SummaryResult;
      if (!mountedRef.current) return;
      setSummaryResult(data);
      setStatus("idle");
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("summarize error:", err);
      setStatus("idle");
      setErrorMsg(t("errors.summarizeShort"));
    } finally {
      finalizingRef.current = false;
    }
  }, [messages, router, t]);

  // 要約を保存（ログイン済のみ）→ 履歴ページへ遷移
  const handleSaveSummary = useCallback(async () => {
    if (!summaryResult || saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: summaryResult.title,
          summary: summaryResult.summary,
          transcript: messages.map((m) => ({ role: m.role, text: m.text })),
          language: summaryResult.language,
          message_count: messages.filter((m) => m.role === "user").length,
        }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        setSaveStatus("error");
        return;
      }
      setSaveStatus("saved");
      // 「保存しました」を読み取れる十分な時間を置いてから履歴へ遷移
      setTimeout(() => {
        if (mountedRef.current) router.push("/diary/history");
      }, 1000);
    } catch (err) {
      console.error("save error:", err);
      if (mountedRef.current) setSaveStatus("error");
    }
  }, [summaryResult, messages, saveStatus, router]);

  // 破棄（保存せずにホームへ戻る）
  const handleDiscard = useCallback(() => {
    setSummaryResult(null);
    setMessages([]);
    router.push("/app");
  }, [router]);

  // 音声処理：Whisper → Claude(diary) → ElevenLabs
  const processAudio = useCallback(
    async (blob: Blob) => {
      setStatus("processing");
      setErrorMsg(null);
      try {
        const fd = new FormData();
        fd.append("audio", blob, `recording.${blob.type.split("/")[1]?.split(";")[0] ?? "webm"}`);
        // UI ロケールを Whisper の language ヒントに連動させる（Track C-4）。
        fd.append("language", locale);
        const trRes = await fetch("/api/transcribe", { method: "POST", body: fd });
        if (!trRes.ok) {
          setStatus("idle");
          setErrorMsg(t("errors.transcribe"));
          return;
        }
        const trData = (await trRes.json()) as { text?: string; error?: string };
        const userText = (trData.text ?? "").trim();
        if (!userText) {
          setStatus("idle");
          return;
        }

        // 終了コマンド検知：会話ログには追加せず、そのまま終了フローへ
        if (isEndCommand(userText)) {
          setStatus("idle");
          await handleFinish();
          return;
        }

        // ゲスト上限チェック（ユーザー発話を messages に追加する前に実施）
        // 上限到達でモーダルを出すが、中途半端な「AI 返答なしターン」を履歴に残さない
        if (isGuest) {
          if (isGuestLimitReached()) {
            setShowLimitModal(true);
            setStatus("idle");
            return;
          }
        }

        const userMsg: Message = { id: uid(), role: "user", text: userText };
        setMessages((prev) => [...prev, userMsg]);

        if (isGuest) {
          const next = incrementGuestCount("chat");
          setGuestCount(next);
        }

        const history = messages.map((m) => ({ role: m.role, content: m.text }));
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            history,
            mode: "diary",
            pastSummaries,
            locale,
          }),
        });
        if (!mountedRef.current) return;
        if (!chatRes.ok) {
          setStatus("idle");
          const err = (await chatRes.json().catch(() => ({}))) as { error?: string };
          setErrorMsg(
            err.error === "SERVICE_QUOTA_EXCEEDED"
              ? t("errors.quotaExceeded")
              : t("errors.chatFetch")
          );
          return;
        }
        const chatData = (await chatRes.json()) as { text?: string };
        const replyText = (chatData.text ?? "").trim();
        if (!replyText) {
          setStatus("idle");
          return;
        }
        if (!mountedRef.current) return;
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: replyText }]);
        await playReply(replyText);
      } catch (err) {
        console.error("processAudio error:", err);
        if (mountedRef.current) {
          setStatus("idle");
          setErrorMsg(t("errors.process"));
        }
      }
    },
    [messages, isGuest, playReply, handleFinish, pastSummaries, locale, t]
  );

  // stale closure 対策：最新の processAudio を ref に保持
  useEffect(() => {
    processAudioRef.current = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorderRef.current?.mimeType ?? "audio/webm",
      });
      return processAudio(blob);
    };
  }, [processAudio]);

  // 録音開始
  const startRecording = useCallback(async () => {
    setErrorMsg(null);

    if (isGuest && isGuestLimitReached()) {
      setShowLimitModal(true);
      return;
    }

    ensureAudioContext();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickBrowserMimeType();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const tracks = streamRef.current?.getTracks() ?? [];
        for (const t of tracks) t.stop();
        streamRef.current = null;

        const duration = Date.now() - startedAtRef.current;
        if (duration < MIN_RECORDING_MS) {
          setStatus("idle");
          setErrorMsg(t("errors.tooShort"));
          return;
        }

        processAudioRef.current?.();
      };

      recorder.start();
      setStatus("recording");
    } catch (err) {
      console.error("getUserMedia error:", err);
      setErrorMsg(mapGetUserMediaError(err));
      setStatus("idle");
    }
  }, [isGuest, ensureAudioContext, t]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const handleMicClick = useCallback(() => {
    if (status === "recording") {
      stopRecording();
    } else if (status === "idle") {
      startRecording();
    }
  }, [status, startRecording, stopRecording]);

  const statusLabel =
    status === "recording"
      ? t("status.recording")
      : status === "processing"
        ? t("status.processing")
        : status === "speaking"
          ? t("status.speaking")
          : t("status.idle");

  const hasUserContent = messages.some((m) => m.role === "user");

  return (
    <main className="flex flex-col h-screen w-full max-w-2xl mx-auto px-4 overflow-hidden">
      {/* ヘッダー：pt は他ページと統一。pb-6 は h-screen 会話画面でマイクボタン領域を
         縦に確保するため、他ページの pb-16 sm:pb-20 とは意図的に違う値を採用 */}
      <header className="flex items-center justify-between pt-10 sm:pt-12 pb-6">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm tracking-wide text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
          {t("header.back")}
        </Link>
        <h1 className="text-sm tracking-wide text-[var(--fg-subtle)]">{t("header.title")}</h1>
        {/* 終了ボタン：会話開始かつユーザー発話があるときは常時押せる。
           processing/speaking 中でも押せる（多重起動は finalizingRef でガード済） */}
        {isStarted && hasUserContent && !summaryResult ? (
          <button
            type="button"
            onClick={() => handleFinish()}
            className="text-sm tracking-wide text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
          >
            {t("header.finish")}
          </button>
        ) : (
          <div className="w-12" />
        )}
      </header>

      {/* ゲスト残数（会話開始後のみ表示） */}
      {isStarted && isGuest && !summaryResult && (
        <div className="mb-3 text-center text-xs text-[var(--fg-subtle)]">
          {t("guestRemaining", {
            remaining: Math.max(0, GUEST_LIMIT - guestCount),
            total: GUEST_LIMIT,
          })}
        </div>
      )}

      {!isStarted ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center animate-fadeIn">
          <p className="text-sm text-[var(--fg-muted)] leading-relaxed max-w-md">
            {t("prompt.body")}
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={status === "processing" || status === "speaking"}
            className="mt-4 border border-[var(--border-strong)] hover:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--fg)] px-10 py-3 rounded-md text-sm tracking-wide transition-colors"
          >
            {status === "processing" ? t("prompt.starting") : t("prompt.start")}
          </button>
          {errorMsg && <div className="mt-2 text-xs text-[var(--error)]">{errorMsg}</div>}
          {authStatus === "authed" && (
            <Link
              href="/diary/history"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-subtle)] hover:text-[var(--accent)] transition-colors mt-2"
            >
              {t("prompt.viewHistory")}
              <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* 会話ログ（LINE 風バブル廃止 → 手紙引用風） */}
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex animate-fadeSlideUp ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap px-4 py-3 rounded-2xl ${
                    m.role === "user"
                      ? "bg-[var(--accent)] text-white rounded-tr-sm"
                      : "bg-[var(--bg-elevated)] text-[var(--fg)] rounded-tl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* エラー */}
          {errorMsg && !summaryResult && (
            <div className="mb-3 px-3 py-2 bg-[var(--error-bg)] border border-[var(--error)] rounded-lg text-[var(--error)] text-xs text-center">
              {errorMsg}
            </div>
          )}

          {/* マイクボタン + ステータス（要約プレビュー中は隠す） */}
          {!summaryResult && (
            <div className="flex flex-col items-center gap-3 pb-6">
              <button
                type="button"
                onClick={handleMicClick}
                disabled={status === "processing" || status === "speaking"}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  status === "recording"
                    ? "bg-[var(--accent-subtle)] border border-[var(--accent)] animate-breathe"
                    : status === "idle"
                      ? "bg-[var(--bg-elevated)] border border-[var(--border-strong)] animate-glow-soft"
                      : "bg-[var(--bg-elevated)] border border-[var(--border)] opacity-60"
                } disabled:cursor-not-allowed`}
                aria-label={status === "recording" ? t("micAria.recording") : t("micAria.idle")}
              >
                <Mic
                  className="w-7 h-7 text-[var(--accent)]"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
              <span className="text-sm text-[var(--fg-muted)]">{statusLabel}</span>
              <span className="text-xs text-[var(--fg-subtle)]">{t("hint")}</span>
            </div>
          )}
        </>
      )}

      {/* 要約プレビューモーダル */}
      {summaryResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="text-xs tracking-wide text-[var(--fg-subtle)] mb-2">
              {t("summary.heading")}
            </div>
            <h2 className="text-xl font-medium text-[var(--fg)] mb-4 leading-relaxed">
              {summaryResult.title}
            </h2>
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed whitespace-pre-wrap mb-6">
              {summaryResult.summary}
            </p>

            {saveStatus === "error" && (
              <div className="mb-4 px-3 py-2 bg-[var(--error-bg)] border border-[var(--error)] rounded-lg text-[var(--error)] text-xs text-center">
                {t("errors.saveFailed")}
              </div>
            )}

            {authStatus === "guest" ? (
              <>
                <p className="text-xs text-[var(--fg-muted)] mb-4 leading-relaxed">
                  {t("summary.guestNote")}
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-sm font-medium rounded-md text-center transition-colors"
                  >
                    {t("summary.guestSave")}
                  </Link>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="px-4 py-2.5 bg-transparent border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] text-sm rounded-md transition-colors"
                  >
                    {t("summary.guestDiscard")}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveSummary}
                  disabled={saveStatus === "saving" || saveStatus === "saved"}
                  className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                >
                  {saveStatus === "saving"
                    ? t("summary.saving")
                    : saveStatus === "saved"
                      ? t("summary.saved")
                      : t("summary.save")}
                </button>
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={saveStatus === "saving" || saveStatus === "saved"}
                  className="px-4 py-2.5 bg-transparent border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-50 disabled:cursor-not-allowed text-sm rounded-md transition-colors"
                >
                  {t("summary.discard")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ゲスト上限モーダル */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-medium text-[var(--fg)] mb-3 leading-relaxed">
              {t("guestLimitModal.title", { limit: GUEST_LIMIT })}
            </h2>
            <p className="text-sm text-[var(--fg-muted)] mb-5 leading-relaxed">
              {t("guestLimitModal.desc")}
            </p>
            <div className="flex gap-2">
              <Link
                href="/login"
                className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-sm font-medium rounded-md text-center transition-colors"
              >
                {t("guestLimitModal.signup")}
              </Link>
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="px-4 py-2.5 bg-transparent border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] text-sm rounded-md transition-colors"
              >
                {t("guestLimitModal.later")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
