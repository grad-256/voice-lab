"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { useAuth } from "@/app/components/auth/AuthContext";
import { BottomTab, BtnGhost, BtnPrimary, Cap, PageHeader, Rule, Waves } from "@/app/components/chapter";
import { Link, useRouter } from "@/i18n/routing";
import { formatElapsedMs } from "@/lib/formatDuration";

import { ELEVENLABS_MULTILINGUAL } from "@/lib/models";
import { mapGetUserMediaError, pickBrowserMimeType } from "@/lib/recordingMime";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { useMountedRef } from "@/lib/useMountedRef";
import { Keyboard, Mic, Send, Square } from "lucide-react";
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

// 終了音声コマンド候補。Whisper 出力を小文字化・句読点除去した上で、
// 単独発話（またはこれ + 軽い語尾）のときだけマッチさせる。
const END_KEYWORDS = [
  "ありがとう",
  "ありがとね",
  "またね",
  "じゃあね",
  "thank you",
  "thanks",
  "bye",
  "goodbye",
] as const;

// 終了コマンドの末尾に付く軽い語尾。「かな」は思案形なので除外。
const END_TAIL_WORDS = ["です", "だよ", "だね", "ね", "よ"] as const;

function uid() {
  return Math.random().toString(36).slice(2);
}

// 終了コマンドとみなすか判定。合言葉の完全一致のみ（語尾付きも許容）。
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
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [pastSummaries, setPastSummaries] = useState<string[]>([]);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // 録音経過時間の表示用（1 秒刻み）。録音停止時点の値を保持し、processing 中も残す。
  const [elapsedMs, setElapsedMs] = useState(0);
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");

  const isGuest = authStatus === "guest";

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const processAudioRef = useRef<(() => Promise<void>) | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  // アンマウント後の state 更新を防ぐための参照（useMountedRef が管理）
  const mountedRef = useMountedRef();
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  // 「はじめる」連打による多重 assistant-first 起動を防ぐ
  const startingRef = useRef(false);
  // 終了フロー（要約生成 + 保存）の多重起動ガード
  const finalizingRef = useRef(false);

  // アンマウント時のクリーンアップ（mountedRef 管理は useMountedRef 側）
  // 録音中にページ離脱した場合も RAF ループ・マイクトラック・音声を確実に停止する
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      analyserRef.current = null;
      const tracks = streamRef.current?.getTracks() ?? [];
      for (const track of tracks) track.stop();
      streamRef.current = null;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // ログイン済のとき、直近日記の要約（最大3件）を取得して文脈継承に使う。
  // API は常に直近5件を返すため、ここで先頭3件に絞る。
  useEffect(() => {
    if (authStatus !== "authed") return;
    let aborted = false;
    fetch("/api/diary")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: { summary?: string }[] } | null) => {
        if (aborted || !mountedRef.current || !data?.items) return;
        const summaries = data.items
          .slice(0, 3)
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
        body: JSON.stringify({ text, modelId: ELEVENLABS_MULTILINGUAL }),
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
          assistantFirst: true,
          pastSummaries,
          locale,
        }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus("idle");
        setIsStarted(false);
        const isLimitError = err.error === "TURN_LIMIT_EXCEEDED";
        if (isLimitError) setIsLimitReached(true);
        if (isGuest && isLimitError) {
          setShowLimitModal(true);
        } else {
          setErrorMsg(isLimitError ? t("errors.turnLimitExceeded") : t("errors.bootstrap"));
        }
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
      // デイリーはテキスト応答のみ。音声応答はプレミアムプランで提供予定
      setStatus("idle");
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("bootstrap error:", err);
      setStatus("idle");
      setErrorMsg(t("errors.bootstrapShort"));
      setIsStarted(false);
    } finally {
      startingRef.current = false;
    }
  }, [isGuest, ensureAudioContext, pastSummaries, locale, t]);

  // 会話終了フロー：要約を生成してプレビュー。ユーザー発話ゼロなら破棄扱い。
  const handleFinish = useCallback(async () => {
    if (finalizingRef.current) return;
    const currentMessages = messages;
    const userTurns = currentMessages.filter((m) => m.role === "user").length;
    if (userTurns === 0) {
      setIsStarted(false);
      setMessages([]);
      return;
    }
    finalizingRef.current = true;
    setStatus("processing");
    setErrorMsg(null);
    setShowSummaryModal(true); // API 待ち前にモーダルを即表示

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
        setShowSummaryModal(false);
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
      setShowSummaryModal(false);
    } finally {
      finalizingRef.current = false;
    }
  }, [messages, t]);

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
    setShowSummaryModal(false);
    setMessages([]);
    setIsStarted(false);
    setSaveStatus("idle");
  }, []);

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

        const userMsg: Message = { id: uid(), role: "user", text: userText };
        setMessages((prev) => [...prev, userMsg]);

        const history = messages.map((m) => ({ role: m.role, content: m.text }));
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            history,
            pastSummaries,
            locale,
          }),
        });
        if (!mountedRef.current) return;
        if (!chatRes.ok) {
          setStatus("idle");
          const err = (await chatRes.json().catch(() => ({}))) as { error?: string };
          const isLimitError = err.error === "TURN_LIMIT_EXCEEDED";
          if (isLimitError) {
            setIsLimitReached(true);
            setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          }
          if (isGuest && isLimitError) {
            setShowLimitModal(true);
          } else {
            setErrorMsg(
              isLimitError
                ? t("errors.turnLimitExceeded")
                : err.error === "SERVICE_QUOTA_EXCEEDED"
                  ? t("errors.quotaExceeded")
                  : t("errors.chatFetch")
            );
          }
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
        // デイリーはテキスト応答のみ。音声応答はプレミアムプランで提供予定
        setStatus("idle");
      } catch (err) {
        console.error("processAudio error:", err);
        if (mountedRef.current) {
          setStatus("idle");
          setErrorMsg(t("errors.process"));
        }
      }
    },
    [messages, isGuest, handleFinish, pastSummaries, locale, t]
  );

  // テキスト手入力パス：Whisper をスキップして直接 /api/chat へ送る（TTS なし）
  const processText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setTextInput("");
      setStatus("processing");
      setErrorMsg(null);

      if (isEndCommand(trimmed)) {
        setStatus("idle");
        await handleFinish();
        return;
      }

      const userMsg: Message = { id: uid(), role: "user", text: trimmed };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.text }));
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history, pastSummaries, locale }),
        });
        if (!mountedRef.current) return;
        if (!chatRes.ok) {
          const err = (await chatRes.json().catch(() => ({}))) as { error?: string };
          const isLimitError = err.error === "TURN_LIMIT_EXCEEDED";
          if (isLimitError) {
            setIsLimitReached(true);
            setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          }
          if (isGuest && isLimitError) {
            setShowLimitModal(true);
          } else {
            setErrorMsg(
              isLimitError
                ? t("errors.turnLimitExceeded")
                : err.error === "SERVICE_QUOTA_EXCEEDED"
                  ? t("errors.quotaExceeded")
                  : t("errors.chatFetch")
            );
          }
          setStatus("idle");
          return;
        }
        const chatData = (await chatRes.json()) as { text?: string };
        const replyText = (chatData.text ?? "").trim();
        if (!mountedRef.current) return;
        if (replyText) {
          setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: replyText }]);
        }
        setStatus("idle");
      } catch (err) {
        console.error("processText error:", err);
        if (mountedRef.current) {
          setStatus("idle");
          setErrorMsg(t("errors.process"));
        }
      }
    },
    [messages, isGuest, handleFinish, pastSummaries, locale, t]
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
    if (isLimitReached) {
      setShowLimitModal(true);
      return;
    }
    setErrorMsg(null);

    ensureAudioContext();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // マイク入力を AnalyserNode に接続し、録音中に音量レベルをリアルタイム取得する
      if (audioCtxRef.current) {
        // iOS Safari は suspended 状態のことがあるため resume() を呼ぶ
        if (audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume().catch(() => {});
        }
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 256;
        audioCtxRef.current.createMediaStreamSource(stream).connect(analyser);
        analyserRef.current = analyser;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (const v of dataArray) {
            const n = (v - 128) / 128;
            sum += n * n;
          }
          setAudioLevel(Math.min(1, Math.sqrt(sum / dataArray.length) * 6));
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
      }

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
        cancelAnimationFrame(animFrameRef.current);
        analyserRef.current = null;
        if (mountedRef.current) setAudioLevel(0);
        const tracks = streamRef.current?.getTracks() ?? [];
        for (const t of tracks) t.stop();
        streamRef.current = null;

        const duration = Date.now() - startedAtRef.current;
        if (duration < MIN_RECORDING_MS) {
          if (mountedRef.current) {
            setStatus("idle");
            setErrorMsg(t("errors.tooShort"));
          }
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
  }, [isLimitReached, ensureAudioContext, t]);

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
  const wavesOpacityActive = isRecording ? 1 : isBusy ? 0.4 : 0;
  const wavesLevel = isRecording ? Math.max(0.1, audioLevel) : isBusy ? 0.3 : 0.15;
  // 録音中：全バー明るく、高さを audioLevel で動かす
  // 処理中：一部バー明るく固定高さ
  // アイドル：全バー暗い（色なし）

  return (
    <main className={`flex flex-col h-screen w-full max-w-md mx-auto px-7 pt-14 overflow-hidden ${isStarted ? "pb-6" : "pb-24"}`}>
      <PageHeader
        center={
          isStarted ? (
            <span className="uppercase tracking-[0.32em] text-xs sm:text-sm text-[var(--fg-muted)]">
              {isRecording ? t("status.recording") : t("header.title")}
            </span>
          ) : null
        }
        right={
          <button
            type="button"
            onClick={() => {
              if (isStarted && hasUserContent && !summaryResult) {
                setShowLeaveModal(true);
              } else {
                router.push("/app");
              }
            }}
            className="uppercase tracking-[0.32em] text-xs sm:text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer p-0"
          >
            ← {t("header.back")}
          </button>
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
          {/* 流れるトランスクリプト：user は Fraunces の本文、assistant は
             「ききて」として左縦罫の引用。バブルを捨て、活字のリズムで階層を作る。 */}
          <div className="flex-1 overflow-y-auto pt-2 pb-4 space-y-5">
            <Cap mb={0}>{t("chapter.liveLabel")}</Cap>
            {messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="animate-fadeSlideUp text-base sm:text-lg leading-loose"
                  style={{ color: "var(--fg)", whiteSpace: "pre-wrap" }}
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
                    style={{ color: "var(--fg)", whiteSpace: "pre-wrap" }}
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

          {!summaryResult && (
            <div className="border-t border-[var(--border)] pt-4">
              {hasUserContent && (
                <div className="flex justify-end mb-3">
                  <button
                    type="button"
                    onClick={() => handleFinish()}
                    disabled={isBusy}
                    className="uppercase tracking-[0.32em] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer p-0 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {t("header.finish")} →
                  </button>
                </div>
              )}
              {textMode ? (
                /* テキスト入力モード */
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-[0.28em] text-[var(--fg-muted)]">
                      {t("textInput.switchToText")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTextMode(false)}
                      disabled={isBusy}
                      className="text-xs uppercase tracking-[0.28em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed p-0"
                    >
                      {t("textInput.switchToVoice")} →
                    </button>
                  </div>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={t("textInput.placeholder")}
                    disabled={isBusy || isLimitReached}
                    rows={4}
                    className="w-full resize-none bg-transparent text-sm sm:text-base leading-relaxed text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none disabled:opacity-50"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span
                      className="text-xs text-[var(--fg-subtle)]"
                      style={{ fontFamily: MONO_FAMILY }}
                    >
                      {textInput.length} / 1000
                    </span>
                    <button
                      type="button"
                      onClick={() => processText(textInput)}
                      disabled={isBusy || isLimitReached || !textInput.trim()}
                      aria-label={t("textInput.send")}
                      className="flex items-center justify-center w-10 h-10 rounded-full text-[var(--bg)] bg-[var(--fg)] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                    >
                      <Send size={15} strokeWidth={1.5} aria-hidden />
                    </button>
                  </div>
                </>
              ) : (
                /* 音声録音モード */
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      aria-hidden
                      className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: "var(--fg)",
                        opacity: isRecording ? 1 : 0.35,
                      }}
                    />
                    <span
                      className="text-xs tracking-[0.06em]"
                      style={{ fontFamily: MONO_FAMILY, color: "var(--fg)" }}
                    >
                      {formatElapsedMs(elapsedMs)}
                    </span>
                    <div className="flex-1">
                      <Waves n={40} h={14} active={wavesOpacityActive} level={wavesLevel} />
                    </div>
                    <span className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)]">
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-8">
                    <button
                      type="button"
                      onClick={() => setTextMode(true)}
                      disabled={isRecording || isBusy}
                      className="flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 p-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Keyboard size={13} strokeWidth={1.5} aria-hidden />
                      {t("textInput.switchToText")}
                    </button>
                    <button
                      type="button"
                      onClick={handleMicClick}
                      disabled={isBusy || isLimitReached}
                      className="w-14 h-14 rounded-full flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: "var(--fg)" }}
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
                          style={{ color: "var(--bg)" }}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-[var(--fg-subtle)] text-center">
                    {t("hint")}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* 要約プレビューモーダル */}
      {showSummaryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn"
          onClick={() => {
            if (summaryResult) {
              setSummaryResult(null);
              setShowSummaryModal(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && summaryResult) {
              setSummaryResult(null);
              setShowSummaryModal(false);
            }
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto p-6 rounded-xl shadow-2xl bg-[var(--bg)] text-[var(--fg)]"
            style={{ border: "0.5px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <Cap mb={0}>{t("summary.heading")}</Cap>
              {summaryResult && (
                <button
                  type="button"
                  onClick={() => {
                    setSummaryResult(null);
                    setShowSummaryModal(false);
                  }}
                  className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer p-0 leading-none"
                  aria-label="閉じる"
                >
                  ✕
                </button>
              )}
            </div>

            {/* ローディング状態：AI 要約生成中 */}
            {!summaryResult ? (
              <div className="py-8 flex flex-col items-center gap-3 text-[var(--fg-muted)]">
                <div className="w-5 h-5 rounded-full border-2 border-[var(--fg-muted)] border-t-transparent animate-spin" />
                <span className="text-xs uppercase tracking-[0.3em]">{t("status.processing")}</span>
              </div>
            ) : (
              <>
                <h2 className="mb-4 text-2xl sm:text-3xl font-semibold leading-tight">
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
                      <div className="flex-1">
                        <BtnGhost full onClick={handleDiscard}>
                          {t("summary.guestDiscard")}
                        </BtnGhost>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className={saveStatus === "saving" ? "animate-pulse" : undefined}>
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
                    </div>
                    <div className="flex-1">
                      <BtnGhost
                        full
                        onClick={handleDiscard}
                        disabled={saveStatus === "saving" || saveStatus === "saved"}
                      >
                        {t("summary.discard")}
                      </BtnGhost>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ゲスト上限モーダル */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn">
          <div
            className="w-full max-w-sm p-6 rounded-xl shadow-2xl bg-[var(--bg)] text-[var(--fg)]"
            style={{ border: "0.5px solid var(--border)" }}
          >
            <Cap mb={6}>{t("summary.heading")}</Cap>
            <h2 className="mb-3 text-xl sm:text-2xl font-semibold leading-tight">
              {t("guestLimitModal.title")}
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

      {/* 離脱確認モーダル：やり取り中に「← 戻る」を押したとき */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn"
          onClick={() => setShowLeaveModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowLeaveModal(false);
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-sm p-6 rounded-xl shadow-2xl bg-[var(--bg)] text-[var(--fg)]"
            style={{ border: "0.5px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <Cap mb={0}>{t("header.title")}</Cap>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer p-0 leading-none"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <h2 className="mb-3 text-2xl sm:text-3xl font-semibold leading-tight">
              {t("leaveModal.title")}
            </h2>
            <p
              className="text-xs sm:text-sm leading-relaxed mb-5"
              style={{ color: "var(--fg-muted)" }}
            >
              {t("leaveModal.desc")}
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <BtnGhost
                  full
                  onClick={() => {
                    setShowLeaveModal(false);
                    router.push("/app");
                  }}
                >
                  {t("leaveModal.discard")}
                </BtnGhost>
              </div>
              <div className="flex-1">
                <BtnPrimary
                  full
                  onClick={() => {
                    setShowLeaveModal(false);
                    handleFinish();
                  }}
                  disabled={isBusy}
                >
                  {t("header.finish")}
                </BtnPrimary>
              </div>
            </div>
          </div>
        </div>
      )}
      {!isStarted && <BottomTab />}
    </main>
  );
}
