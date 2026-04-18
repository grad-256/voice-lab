"use client";

export const dynamic = "force-dynamic";

import { Link, useRouter } from "@/i18n/routing";
import {
  GUEST_LIMIT,
  getGuestCount,
  incrementGuestCount,
  isGuestLimitReached,
} from "@/lib/guestUsage";
import { mapGetUserMediaError, pickBrowserMimeType } from "@/lib/recordingMime";
import { createClient } from "@/lib/supabase/client";
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
        body: JSON.stringify({ text }),
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
        }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        setStatus("idle");
        setErrorMsg("AI の準備に失敗しました。もう一度お試しください。");
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
      setErrorMsg("AI の準備に失敗しました。");
      setIsStarted(false);
    } finally {
      startingRef.current = false;
    }
  }, [isGuest, playReply, ensureAudioContext, pastSummaries]);

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
          err.error === "SERVICE_QUOTA_EXCEEDED"
            ? "AI の上限に達しました。少し時間をおいてお試しください。"
            : "要約の生成に失敗しました。もう一度お試しください。"
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
      setErrorMsg("要約の生成に失敗しました。");
    } finally {
      finalizingRef.current = false;
    }
  }, [messages, router]);

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
        const trRes = await fetch("/api/transcribe", { method: "POST", body: fd });
        if (!trRes.ok) {
          setStatus("idle");
          setErrorMsg("音声の文字起こしに失敗しました。");
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
          }),
        });
        if (!mountedRef.current) return;
        if (!chatRes.ok) {
          setStatus("idle");
          const err = (await chatRes.json().catch(() => ({}))) as { error?: string };
          setErrorMsg(
            err.error === "SERVICE_QUOTA_EXCEEDED"
              ? "AI の上限に達しました。少し時間をおいてお試しください。"
              : "AI 応答の取得に失敗しました。"
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
          setErrorMsg("処理中にエラーが発生しました。");
        }
      }
    },
    [messages, isGuest, playReply, handleFinish, pastSummaries]
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
          setErrorMsg("もう少し長く話してください（1.5秒以上）");
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
  }, [isGuest, ensureAudioContext]);

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
      ? "聞いています…"
      : status === "processing"
        ? "考えています…"
        : status === "speaking"
          ? "話しています…"
          : "タップして話す";

  const hasUserContent = messages.some((m) => m.role === "user");

  return (
    <main className="flex flex-col h-screen w-full max-w-2xl mx-auto px-4 overflow-hidden">
      {/* ヘッダー */}
      <header className="flex items-center justify-between pt-6 pb-2">
        <Link
          href="/app"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
        >
          ← 戻る
        </Link>
        <h1 className="text-sm text-gray-400">声の日記</h1>
        {/* 終了ボタン：会話開始かつユーザー発話があるときは常時押せる。
           processing/speaking 中でも押せる（多重起動は finalizingRef でガード済） */}
        {isStarted && hasUserContent && !summaryResult ? (
          <button
            type="button"
            onClick={() => handleFinish()}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            終わる
          </button>
        ) : (
          <div className="w-12" />
        )}
      </header>

      {/* ゲスト残数（会話開始後のみ表示） */}
      {isStarted && isGuest && !summaryResult && (
        <div className="mb-3 text-center text-xs text-gray-500">
          残り {Math.max(0, GUEST_LIMIT - guestCount)} / {GUEST_LIMIT} 回（ゲスト）
        </div>
      )}

      {!isStarted ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <h2 className="text-xl font-semibold text-white leading-relaxed">
            今日のこと、声にしてみませんか。
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
            「はじめる」を押すと、AI から声で話しかけます。
            <br />
            マイクへのアクセスを求められたら、許可してください。
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={status === "processing" || status === "speaking"}
            className="mt-2 px-10 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-full transition-colors"
          >
            {status === "processing" ? "声を用意しています…" : "はじめる"}
          </button>
          {errorMsg && <div className="mt-2 text-red-300 text-xs">{errorMsg}</div>}
          {authStatus === "authed" && (
            <Link
              href="/diary/history"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-2"
            >
              過去の日記を見る →
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* 会話ログ */}
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-100"
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
            <div className="mb-3 px-3 py-2 bg-red-900/60 border border-red-700 rounded-lg text-red-200 text-xs text-center">
              {errorMsg}
            </div>
          )}

          {/* マイクボタン + ステータス（要約プレビュー中は隠す） */}
          {!summaryResult && (
            <div className="flex flex-col items-center gap-2 pb-4">
              <button
                type="button"
                onClick={handleMicClick}
                disabled={status === "processing" || status === "speaking"}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  status === "recording"
                    ? "bg-red-500 scale-110 animate-pulse"
                    : status === "idle"
                      ? "bg-indigo-600 hover:bg-indigo-500"
                      : "bg-gray-700"
                } disabled:cursor-not-allowed`}
                aria-label={status === "recording" ? "録音停止" : "録音開始"}
              >
                <svg
                  className="w-8 h-8 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" />
                  <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
                </svg>
              </button>
              <span className="text-sm text-gray-300">{statusLabel}</span>
              <span className="text-xs text-gray-400">
                「終わり」と言うか、右上のボタンで日記になります
              </span>
            </div>
          )}
        </>
      )}

      {/* 要約プレビューモーダル */}
      {summaryResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="text-xs text-gray-500 mb-1">今日の日記</div>
            <h2 className="text-lg font-semibold text-white mb-4 leading-relaxed">
              {summaryResult.title}
            </h2>
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap mb-6">
              {summaryResult.summary}
            </p>

            {saveStatus === "error" && (
              <div className="mb-4 px-3 py-2 bg-red-900/60 border border-red-700 rounded-lg text-red-200 text-xs text-center">
                保存に失敗しました。もう一度お試しください。
              </div>
            )}

            {authStatus === "guest" ? (
              <>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  日記として残すには登録が必要です。登録は 30 秒で終わります。
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg text-center transition-colors"
                  >
                    登録して保存
                  </Link>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                  >
                    今回は捨てる
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveSummary}
                  disabled={saveStatus === "saving" || saveStatus === "saved"}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saveStatus === "saving"
                    ? "保存しています…"
                    : saveStatus === "saved"
                      ? "保存しました"
                      : "保存する"}
                </button>
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={saveStatus === "saving" || saveStatus === "saved"}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm rounded-lg transition-colors"
                >
                  捨てる
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ゲスト上限モーダル */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-white mb-2">
              {GUEST_LIMIT} 回話してくれてありがとう
            </h2>
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              ここから先は、登録すると続きが話せて、日記として保存できます。登録は 30
              秒で終わります。
            </p>
            <div className="flex gap-2">
              <Link
                href="/login"
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg text-center transition-colors"
              >
                登録する
              </Link>
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                あとで
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
