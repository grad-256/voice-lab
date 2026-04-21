"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { useAuth } from "@/app/components/auth/AuthContext";
import { BtnGhost, BtnPrimary, Cap, PageHeader, Rule, Waves } from "@/app/components/chapter";
import { Link, useRouter } from "@/i18n/routing";
import { formatElapsedMs } from "@/lib/formatDuration";
import {
  GUEST_LIMIT,
  getGuestCount,
  incrementGuestCount,
  isGuestLimitReached,
} from "@/lib/guestUsage";
import { mapGetUserMediaError, pickBrowserMimeType } from "@/lib/recordingMime";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { useMountedRef } from "@/lib/useMountedRef";
import { Mic, Square } from "lucide-react";
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
  const { openDialog, user, loading: authLoading } = useAuth();
  // UI ロケール（ja/en）。Whisper の language ヒントと chat ルートのシステムプロンプトへ渡す。
  const locale = useLocale();
  const t = useTranslations("diary");
  // プロンプト見出しは /app と共用するため hub.chapter 側の訳を使う。
  const tHub = useTranslations("hub.chapter");

  // AuthContext の user / loading から authStatus を派生。AuthContext が
  // 初回 getUser() を 1 回済ませているので、重複呼び出しはしない。
  const authStatus: AuthStatus = authLoading ? "unknown" : user ? "authed" : "guest";
  const [isStarted, setIsStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [pastSummaries, setPastSummaries] = useState<string[]>([]);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // 録音経過時間の表示用（1 秒刻み）。録音停止時点の値を保持し、processing 中も残す。
  const [elapsedMs, setElapsedMs] = useState(0);

  const isGuest = authStatus === "guest";

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processAudioRef = useRef<(() => Promise<void>) | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  // アンマウント後の state 更新を防ぐための参照（useMountedRef が管理）
  const mountedRef = useMountedRef();
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  // 「はじめる」連打による多重 assistant-first 起動を防ぐ
  const startingRef = useRef(false);
  // 終了フロー（要約生成 + 保存）の多重起動ガード
  const finalizingRef = useRef(false);

  // アンマウント時に再生中音声を停止する（mountedRef 管理は useMountedRef 側）
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // ゲスト回数のみローカルから復元。authStatus は AuthContext から派生しているので副作用不要。
  useEffect(() => {
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
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // 録音中だけ elapsed を 1 秒刻みで更新する。状態が切り替わった瞬間の値で止める。
  useEffect(() => {
    if (status !== "recording") return;
    const tick = () => setElapsedMs(Date.now() - startedAtRef.current);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status]);

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
      setElapsedMs(0);

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
  const isRecording = status === "recording";
  const isBusy = status === "processing" || status === "speaking";
  const wavesActive = isRecording ? 1 : isBusy ? 0.35 : 0.2;

  return (
    <main className="flex flex-col h-screen w-full max-w-md mx-auto px-7 pt-14 pb-6 overflow-hidden">
      <PageHeader
        center={
          isStarted ? (
            <span className="uppercase tracking-[0.32em] text-xs sm:text-sm text-[var(--fg-muted)]">
              {isRecording ? t("status.recording") : t("header.title")}
            </span>
          ) : null
        }
        right={
          isStarted && hasUserContent && !summaryResult ? (
            <button
              type="button"
              onClick={() => handleFinish()}
              className="uppercase tracking-[0.32em] text-xs sm:text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer p-0"
            >
              {t("header.finish")}
            </button>
          ) : (
            <Link
              href="/app"
              className="uppercase tracking-[0.32em] text-xs sm:text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              ← {t("header.back")}
            </Link>
          )
        }
      />

      {/* プロンプト柱：/app と同じ「今日の問い」を Fraunces italic で静かに再掲する。
         /app から Begin で来た流れを断ち切らないため、視覚の連続性を優先。 */}
      <div className="mt-6">
        <Cap mb={10}>{tHub("promptLabel")}</Cap>
        <div
          className="text-xl sm:text-2xl leading-tight tracking-tight"
          style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
        >
          {tHub("promptBody")}
        </div>
      </div>

      <Rule mv={18} />

      {!isStarted ? (
        <div className="flex-1 flex flex-col items-stretch gap-5 animate-fadeIn">
          {isGuest && (
            <Cap mb={0}>
              {t("guestRemaining", {
                remaining: Math.max(0, GUEST_LIMIT - guestCount),
                total: GUEST_LIMIT,
              })}
            </Cap>
          )}
          <p className="text-xs sm:text-sm text-[var(--fg-muted)] leading-relaxed">
            {t("prompt.body")}
          </p>
          {errorMsg && <div className="text-xs sm:text-sm text-[var(--error)]">{errorMsg}</div>}
          <div className="mt-1">
            <BtnPrimary
              big
              full
              onClick={handleStart}
              disabled={status === "processing" || status === "speaking"}
            >
              {status === "processing" ? t("prompt.starting") : t("prompt.start")}
            </BtnPrimary>
          </div>
          {authStatus === "authed" && (
            <Link
              href="/diary/history"
              className="uppercase text-xs sm:text-sm tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors self-start"
            >
              {t("prompt.viewHistory")} →
            </Link>
          )}
          <div className="flex-1" />
        </div>
      ) : (
        <>
          {isGuest && !summaryResult && (
            <div className="mb-2">
              <Cap mb={0}>
                {t("guestRemaining", {
                  remaining: Math.max(0, GUEST_LIMIT - guestCount),
                  total: GUEST_LIMIT,
                })}
              </Cap>
            </div>
          )}

          {/* 流れるトランスクリプト：user は Fraunces の本文、assistant は
             「ききて」として左縦罫の引用。バブルを捨て、活字のリズムで階層を作る。 */}
          <div className="flex-1 overflow-y-auto pt-2 pb-4 space-y-5">
            <Cap mb={0}>{t("chapter.liveLabel")}</Cap>
            {messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="animate-fadeSlideUp text-base sm:text-lg leading-loose"
                  style={{
                    fontFamily: SERIF_FAMILY,
                    color: "var(--fg)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.text}
                </div>
              ) : (
                <div
                  key={m.id}
                  className="animate-fadeSlideUp"
                  style={{ borderLeft: "1.5px solid var(--fg)", paddingLeft: 12 }}
                >
                  <div className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-muted)] mb-1">
                    {t("chapter.quietVoice")}
                  </div>
                  <div
                    className="text-sm sm:text-base leading-normal"
                    style={{
                      fontFamily: SERIF_FAMILY,
                      color: "var(--fg)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              )
            )}
            <div ref={transcriptEndRef} />
          </div>

          {errorMsg && !summaryResult && (
            <div className="mb-3 text-xs sm:text-sm text-[var(--error)] text-center">
              {errorMsg}
            </div>
          )}

          {/* 録音パネル：Waves + 経過時間 + ステータス + マイクボタン。
             Chapter 設計の 3 段構成を踏襲しつつ、既存の単一マイク操作 UX を保つ。 */}
          {!summaryResult && (
            <div className="border-t border-[var(--border)] pt-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-block w-[7px] h-[7px] rounded-full"
                  style={{
                    backgroundColor: "var(--fg)",
                    opacity: isRecording ? 1 : 0.35,
                  }}
                />
                <span
                  className="text-xs sm:text-sm tracking-[0.06em]"
                  style={{ fontFamily: MONO_FAMILY, color: "var(--fg)" }}
                >
                  {formatElapsedMs(elapsedMs)}
                </span>
                <div className="flex-1">
                  <Waves n={40} h={14} active={wavesActive} />
                </div>
                <span className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-muted)]">
                  {statusLabel}
                </span>
              </div>

              <div className="flex items-center justify-center mt-4">
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={isBusy}
                  className="relative w-16 h-16 rounded-full flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: isRecording ? "var(--fg)" : "transparent",
                    border: isRecording
                      ? "0.5px solid var(--fg)"
                      : "0.5px solid var(--border-strong)",
                  }}
                  aria-label={isRecording ? t("micAria.recording") : t("micAria.idle")}
                >
                  {isRecording ? (
                    <Square
                      size={18}
                      strokeWidth={1.2}
                      style={{ color: "var(--bg)" }}
                      fill="var(--bg)"
                      aria-hidden="true"
                    />
                  ) : (
                    <Mic
                      size={20}
                      strokeWidth={1.2}
                      style={{ color: "var(--fg)" }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>

              <div className="mt-3 text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-subtle)] text-center">
                {t("hint")}
              </div>
            </div>
          )}
        </>
      )}

      {/* 要約プレビューモーダル（Chapter 系の 0.5px 罫と Fraunces を徹底） */}
      {summaryResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn">
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto p-6 bg-[var(--bg)] text-[var(--fg)]"
            style={{ border: "0.5px solid var(--fg)" }}
          >
            <Cap mb={6}>{t("summary.heading")}</Cap>
            <h2
              className="mb-4 text-2xl sm:text-3xl leading-tight tracking-tight"
              style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
            >
              {summaryResult.title}
            </h2>
            <p
              className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap mb-6"
              style={{ color: "var(--fg-muted)" }}
            >
              {summaryResult.summary}
            </p>

            {saveStatus === "error" && (
              <div className="mb-4 text-xs sm:text-sm text-[var(--error)] text-center">
                {t("errors.saveFailed")}
              </div>
            )}

            {authStatus === "guest" ? (
              <>
                <p className="text-xs sm:text-sm text-[var(--fg-muted)] mb-4 leading-relaxed">
                  {t("summary.guestNote")}
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <BtnPrimary accent full onClick={() => openDialog("signup")}>
                      {t("summary.guestSave")}
                    </BtnPrimary>
                  </div>
                  <BtnGhost onClick={handleDiscard}>{t("summary.guestDiscard")}</BtnGhost>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1">
                  <BtnPrimary
                    full
                    onClick={handleSaveSummary}
                    disabled={saveStatus === "saving" || saveStatus === "saved"}
                  >
                    {saveStatus === "saving"
                      ? t("summary.saving")
                      : saveStatus === "saved"
                        ? t("summary.saved")
                        : t("summary.save")}
                  </BtnPrimary>
                </div>
                <BtnGhost
                  onClick={handleDiscard}
                  disabled={saveStatus === "saving" || saveStatus === "saved"}
                >
                  {t("summary.discard")}
                </BtnGhost>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ゲスト上限モーダル */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn">
          <div
            className="w-full max-w-sm p-6 bg-[var(--bg)] text-[var(--fg)]"
            style={{ border: "0.5px solid var(--fg)" }}
          >
            <Cap mb={6}>{t("summary.heading")}</Cap>
            <h2
              className="mb-3 text-xl sm:text-2xl leading-tight tracking-tight"
              style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
            >
              {t("guestLimitModal.title", { limit: GUEST_LIMIT })}
            </h2>
            <p
              className="text-xs sm:text-sm leading-relaxed mb-5"
              style={{ color: "var(--fg-muted)" }}
            >
              {t("guestLimitModal.desc")}
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <BtnPrimary
                  accent
                  full
                  onClick={() => {
                    // ゲスト上限モーダルを閉じてからサインアップダイアログを開く（モーダル二重表示回避）
                    setShowLimitModal(false);
                    openDialog("signup");
                  }}
                >
                  {t("guestLimitModal.signup")}
                </BtnPrimary>
              </div>
              <BtnGhost onClick={() => setShowLimitModal(false)}>
                {t("guestLimitModal.later")}
              </BtnGhost>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
