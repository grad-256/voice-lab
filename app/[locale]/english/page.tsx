"use client";

// 静的プリレンダリングを無効化（Supabase クライアントはビルド時に初期化できないため）
export const dynamic = "force-dynamic";

import { SavePhraseModal } from "@/app/components/SavePhraseModal";
import { SuggestPanel } from "@/app/components/SuggestPanel";
import { Link, useRouter } from "@/i18n/routing";
import type { ConversationLevel } from "@/lib/chat";
import {
  appendMessage,
  createConversation,
  getOrCreateConversation,
  loadFeedback,
  loadMessages,
} from "@/lib/conversations";
import {
  GUEST_LIMIT,
  getGuestCount,
  incrementGuestCount,
  isGuestLimitReached,
} from "@/lib/guestUsage";
import { normalizeEnglish } from "@/lib/normalizeEnglish";
import { type Persona, getPersonas } from "@/lib/personas";
import { matchPlayedPhrase, readPlayedPhrases } from "@/lib/playedPhraseHistory";
import type { SuggestPhrase, SuggestRecentMessage } from "@/lib/suggest";
import { createClient } from "@/lib/supabase/client";
import { getGuestSelectedVoiceId } from "@/lib/voiceSessionStorage";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

// ────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────
type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  text: string;
  translation?: string | null;
};

type Status =
  | "idle" // 待機中
  | "recording" // 録音中
  | "processing" // Whisper → Claude → ElevenLabs
  | "speaking"; // 音声再生中

function uid() {
  return Math.random().toString(36).slice(2);
}

// ────────────────────────────────────────────────
// ゲスト用デフォルトペルソナ
// ────────────────────────────────────────────────
const GUEST_PERSONA: Persona = {
  id: "guest",
  user_id: "guest",
  name: "Yuki",
  style_prompt:
    "You are Yuki, a friendly English conversation partner. Keep responses short and encouraging.",
  voice_id: "EXAVITQu4vr4xnSDxMaL",
  created_at: "",
};

// ────────────────────────────────────────────────
// メインコンポーネント（useSearchParams を使うため Suspense でラップ）
// ────────────────────────────────────────────────
function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [level, setLevel] = useState<ConversationLevel>("beginner");
  const [isGuest, setIsGuest] = useState(false);
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  const [guestCount, setGuestCount] = useState(0);

  // 分身の声 voice_id（「これ言えなかった」モーダルで VoicePlayButton に渡す）
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  // 「これ言えなかった」モーダル
  // prefillJaText は常に空（「日本語で書き直す欄」として使う）。
  // referenceUserText に押下元のユーザー発話（Whisper 出力）を渡し、モーダル上部に参考表示する。
  const [savePhraseOpen, setSavePhraseOpen] = useState(false);
  const [savePhraseReferenceText, setSavePhraseReferenceText] = useState<string>("");

  // フィードバック状態（メッセージ ID → 'positive' | 'negative'）
  const [feedback, setFeedback] = useState<Record<string, "positive" | "negative">>({});

  // サジェストパネルの表示フラグ（Sprint 6 改訂：プル型）。
  // ユーザーが「フレーズのヒント」ボタンを押したときだけ true になる。
  const [showSuggestPanel, setShowSuggestPanel] = useState(false);

  // [ このフレーズで話す ] で指定された「次発話として扱うフレーズ」。
  // 送信時に phrase_id 直接突合に使い、送信後にクリアする。
  const [pendingPrefill, setPendingPrefill] = useState<SuggestPhrase | null>(null);
  const pendingPrefillRef = useRef<SuggestPhrase | null>(null);
  useEffect(() => {
    pendingPrefillRef.current = pendingPrefill;
  }, [pendingPrefill]);

  // 音声認識中フラグ（true: Whisper処理中 → ユーザー側プレースホルダー表示）
  const [transcribing, setTranscribing] = useState(false);

  // 現在の会話 ID（DB 保存に使用）
  const conversationIdRef = useRef<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recordingStartRef = useRef<number>(0);
  const processAudioRef = useRef<((blob: Blob) => Promise<void>) | null>(null);

  // ゲスト検出：未ログインならデフォルトペルソナを設定
  // 合わせて「分身の声」voice_id を取得（ゲスト：localStorage / 認証：/api/voice-session）
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsGuest(true);
        setPersona(GUEST_PERSONA);
        setGuestCount(getGuestCount());
        posthog.capture("guest_session_started");
        if (isGuestLimitReached()) {
          setShowGuestLimitModal(true);
          posthog.capture("guest_limit_reached");
        }
        setSelectedVoiceId(getGuestSelectedVoiceId());
        return;
      }
      try {
        const res = await fetch("/api/voice-session");
        if (res.ok) {
          const { voiceId } = (await res.json()) as { voiceId: string | null };
          setSelectedVoiceId(voiceId ?? null);
        }
      } catch {
        // 分身の声未設定は致命的ではない（モーダル側が導線を出す）
      }
    })();
  }, [supabase]);

  // URL パラメータからキャラを読み込み、会話履歴を復元
  useEffect(() => {
    if (isGuest) return;
    const personaId = searchParams.get("persona");
    if (!personaId) return;

    (async () => {
      try {
        const list = await getPersonas();
        const found = list.find((p) => p.id === personaId) ?? null;
        setPersona(found);

        if (!found) return;

        // 会話 ID を取得（または新規作成）して履歴を復元
        const convId = await getOrCreateConversation(found.id);
        conversationIdRef.current = convId;
        const history = await loadMessages(convId);
        setMessages(
          history.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.content,
            translation: m.translation,
          }))
        );
        // DB から自分のフィードバックを復元して初期状態に反映
        const assistantIds = history.filter((m) => m.role === "assistant").map((m) => m.id);
        const savedFeedback = await loadFeedback(assistantIds);
        setFeedback(savedFeedback);
      } catch {
        setErrorMsg("キャラクターの読み込みに失敗しました");
      }
    })();
  }, [searchParams, isGuest]);

  // 自動スクロール
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length で意図的にトリガー
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ────────────────────────────────────────────────
  // 録音 開始
  // ────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        for (const t of stream.getTracks()) t.stop();
        console.log("録音 blob size:", blob.size, "bytes");
        if (blob.size < 1000) {
          // processAudioRef は触らない：ここで null にすると次回の録音でも
          // `recorder.onstop → processAudioRef.current?.(blob)` が no-op になり、
          // 以降のターンまで Whisper パイプラインが永続的に詰まる（iOS Safari で再現）。
          // `transcribing` も併せてリセットしてプレースホルダの残留を防ぐ。
          setTranscribing(false);
          setErrorMsg("音声が短すぎます。もう少し長く話してください。");
          setStatus("idle");
          return;
        }
        processAudioRef.current?.(blob);
      };

      recorder.start(100);
      recordingStartRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
    } catch {
      setErrorMsg("マイクへのアクセスが許可されていません");
    }
  }, []);

  // ────────────────────────────────────────────────
  // 録音 停止
  // ────────────────────────────────────────────────
  const MIN_RECORDING_MS = 1500;

  const stopRecording = useCallback(() => {
    const elapsed = Date.now() - recordingStartRef.current;
    if (elapsed < MIN_RECORDING_MS) {
      const remaining = MIN_RECORDING_MS - elapsed;
      setTimeout(() => {
        mediaRecorderRef.current?.stop();
        setStatus("processing");
        setTranscribing(true);
      }, remaining);
    } else {
      mediaRecorderRef.current?.stop();
      setStatus("processing");
      setTranscribing(true);
    }
  }, []);

  // ────────────────────────────────────────────────
  // パイプライン: 音声 → Whisper → Claude → ElevenLabs → 再生
  // ────────────────────────────────────────────────
  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      try {
        // 1. Whisper: 音声 → テキスト
        const form = new FormData();
        form.append("audio", audioBlob, "audio.webm");
        const transcribeRes = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
        });
        const { text: userText, error: t_err } = await transcribeRes.json();
        if (t_err === "SERVICE_QUOTA_EXCEEDED") {
          setQuotaExceeded(true);
          setStatus("idle");
          return;
        }
        if (t_err || !userText) throw new Error(t_err ?? "音声認識に失敗しました");

        // ユーザーメッセージを DB に保存（ゲスト時はスキップ）
        const userDbId =
          !isGuest && conversationIdRef.current
            ? await appendMessage(conversationIdRef.current, "user", userText).catch(() => uid())
            : uid();
        const userMsg: Message = { id: userDbId, role: "user", text: userText };
        // Whisper完了 → ユーザー発言確定。プレースホルダーを解除して実メッセージを追加
        setTranscribing(false);
        setMessages((prev) => [...prev, userMsg]);

        // 再生→発話の突合（mvp-scope.md 4.5 節）。phrase_id 直接突合 → 正規化テキスト一致の順で判定。
        // ここで消費するため、突合の有無に関わらず pendingPrefill は ref/state をクリアする。
        const prefilled = pendingPrefillRef.current;
        pendingPrefillRef.current = null;
        setPendingPrefill(null);
        const userTextNormalized = normalizeEnglish(userText);
        const match = matchPlayedPhrase(userText, readPlayedPhrases(), {
          prefilledPhraseId: prefilled?.phrase_id ?? null,
        });
        if (match) {
          posthog.capture("phrase_used_in_chat", {
            phrase_id: match.phrase_id,
            source: match.source,
            match_strategy: match.match_strategy,
          });
        }

        // 2. Claude: テキスト → 返答（キャラのシステムプロンプトを渡す）
        const history = messages.map(({ role, text }) => ({ role, content: text }));
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            history,
            systemPrompt: persona?.style_prompt,
            level,
          }),
        });
        const { text: aiText, translation: aiTranslation, error: c_err } = await chatRes.json();
        if (c_err === "SERVICE_QUOTA_EXCEEDED") {
          setQuotaExceeded(true);
          setStatus("idle");
          return;
        }
        if (c_err || !aiText) throw new Error(c_err ?? "AI 応答の取得に失敗しました");

        // AI メッセージを DB に保存（ゲスト時はスキップ）
        const aiDbId =
          !isGuest && conversationIdRef.current
            ? await appendMessage(
                conversationIdRef.current,
                "assistant",
                aiText,
                aiTranslation
              ).catch(() => uid())
            : uid();
        const aiMsg: Message = {
          id: aiDbId,
          role: "assistant",
          text: aiText,
          translation: aiTranslation,
        };
        setMessages((prev) => [...prev, aiMsg]);

        // 会話 1 ターン完了イベント（mvp-scope.md 4.3 節 / Sprint 4 追加）。
        // used_suggest はプレフィル or 突合成立したかで判定（PostHog 側の集計容易性のため）。
        posthog.capture("chat_turn_completed", {
          persona_id: persona?.id ?? null,
          used_suggest: Boolean(prefilled) || Boolean(match),
          user_text_normalized: userTextNormalized,
        });

        const isGoodbye = /\b(bye|goodbye)\b/i.test(userText);

        // ゲストの場合は利用回数をカウント
        if (isGuest) {
          const newCount = incrementGuestCount("chat");
          setGuestCount(newCount);
          posthog.capture("guest_usage_incremented", {
            event: "chat",
            count: newCount,
          });
          if (newCount >= GUEST_LIMIT) {
            setShowGuestLimitModal(true);
            setStatus("idle");
            return;
          }
        }

        // 3. ElevenLabs: テキスト → 音声（キャラのボイス ID を渡す）
        const speakRes = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: aiText,
            voiceId: persona?.voice_id,
          }),
        });
        if (!speakRes.ok) {
          const { error: s_err } = await speakRes.json();
          if (s_err === "SERVICE_QUOTA_EXCEEDED") {
            setQuotaExceeded(true);
            setStatus("idle");
            return;
          }
          throw new Error("音声生成に失敗しました");
        }

        const audioBuffer = await speakRes.arrayBuffer();
        const audioUrl = URL.createObjectURL(new Blob([audioBuffer], { type: "audio/mpeg" }));

        // 4. 自動再生
        setStatus("speaking");
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (isGoodbye && persona) {
            // 新しい会話セッションを作成してメッセージをリセット
            setTimeout(async () => {
              if (!isGuest) {
                const newConvId = await createConversation(persona.id).catch(() => null);
                if (newConvId) conversationIdRef.current = newConvId;
              }
              setMessages([]);
            }, 3000);
          }
          setStatus("idle");
        };
        audio.onerror = () => {
          setErrorMsg("音声の再生に失敗しました");
          setStatus("idle");
        };
        await audio.play();
      } catch (err) {
        // エラー時も必ず transcribing をリセット（青い点々が残らないよう）
        setTranscribing(false);
        setErrorMsg(err instanceof Error ? err.message : "エラーが発生しました");
        setStatus("idle");
      }
    },
    [messages, persona, isGuest, level]
  );

  useEffect(() => {
    processAudioRef.current = processAudio;
  }, [processAudio]);

  // ────────────────────────────────────────────────
  // フィードバック送信
  // ────────────────────────────────────────────────
  const handleFeedback = useCallback(
    (messageId: string, rating: "positive" | "negative") => {
      // 解除時（同じ rating を再タップ）は state だけ更新し API は呼ばない
      setFeedback((prev) => {
        if (prev[messageId] === rating) {
          const next = { ...prev };
          delete next[messageId];
          return next;
        }
        return { ...prev, [messageId]: rating };
      });

      // 解除でなく新規 or 変更の場合のみ、ログイン済みユーザーは API に送信
      if (!isGuest && feedback[messageId] !== rating) {
        fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, rating }),
        }).catch(() => {});
      }
    },
    [isGuest, feedback]
  );

  // ゲスト用カウンター表示
  const guestRemaining = GUEST_LIMIT - guestCount;

  // サジェストに渡す会話履歴（末尾のみ取る）。messages の参照一貫性を壊さないよう useMemo。
  const recentMessages = useMemo<SuggestRecentMessage[]>(
    () => messages.map((m) => ({ role: m.role, content: m.text })),
    [messages]
  );
  // Sprint 6 改訂：プル型サジェスト。ユーザーが明示的にボタンを押した時のみパネルを開く。
  // 録音・処理中は出さない（UX：録音中に操作できても混乱する）。
  const isIdle = status === "idle" && !transcribing;
  const canRequestSuggest = persona !== null && isIdle;
  // パネル側に渡す timing：会話がまだ無ければ `before_chat`（オープナー）、
  // あれば `during_chat`（次の一言）。本文は既存 `/api/suggest` をそのまま利用。
  const suggestTiming: "before_chat" | "during_chat" =
    messages.length === 0 ? "before_chat" : "during_chat";

  const handlePrefill = useCallback((phrase: SuggestPhrase) => {
    setPendingPrefill(phrase);
    // プレフィル後はパネルを閉じる（ユーザーは録音ボタンへ視線を戻すため）
    setShowSuggestPanel(false);
  }, []);

  const handleRequestSuggest = useCallback(() => {
    setShowSuggestPanel(true);
    posthog.capture("suggest_requested", {
      timing: messages.length === 0 ? "before_chat" : "during_chat",
    });
  }, [messages.length]);

  const handleCloseSuggest = useCallback(() => {
    setShowSuggestPanel(false);
  }, []);

  // ────────────────────────────────────────────────
  // ステータスラベル
  // ────────────────────────────────────────────────
  const personaName = persona?.name ?? "キャラ未選択";
  const statusLabel: Record<Status, string> = {
    idle: persona ? "タップして話す" : "キャラクターを選んでください",
    recording: "録音中... もう一度タップで停止",
    processing: `${personaName} が考えています...`,
    speaking: `${personaName} が話しています...`,
  };

  const isButtonDisabled =
    !persona ||
    status === "processing" ||
    status === "speaking" ||
    quotaExceeded ||
    showGuestLimitModal;

  // ────────────────────────────────────────────────
  // レンダリング
  // ────────────────────────────────────────────────
  return (
    <main className="flex flex-col h-screen w-full max-w-2xl mx-auto px-4 overflow-hidden">
      {/* ヘッダー */}
      <header className="py-3 border-b border-gray-800 flex items-center gap-3">
        {/* キャラアバター */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
          {persona ? persona.name.charAt(0).toUpperCase() : "?"}
        </div>

        {/* キャラ名 */}
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white text-base truncate">{personaName}</h1>
          {status === "speaking" && (
            <p className="text-sm text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              話し中
            </p>
          )}
        </div>

        {/* ナビゲーション */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            href="/echo"
            className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded"
          >
            場面で聞く
          </Link>
          <Link
            href="/settings/voice"
            className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded"
          >
            分身の声
          </Link>
          <Link
            href="/personas"
            className={`text-sm text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded ${isGuest ? "pointer-events-none opacity-40" : ""}`}
          >
            キャラ変更
          </Link>
          <Link
            href="/settings"
            className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded"
          >
            設定
          </Link>
        </div>
      </header>

      {/* レベル選択 */}
      {(() => {
        const levels = ["beginner", "intermediate", "advanced"] as const;
        const labels = { beginner: "初級", intermediate: "中級", advanced: "上級" };
        const descriptions = {
          beginner: "A1-A2 ・ 短い文・やさしい語彙",
          intermediate: "B1-B2 ・ 日常表現・自然な会話",
          advanced: "C1 ・ 豊かな語彙・複雑な表現",
        };
        const levelIndex = levels.indexOf(level);
        return (
          <div className="py-2 border-b border-gray-800/50">
            <div
              className={`relative grid grid-cols-3 rounded-lg p-1 ${isGuest ? "bg-gray-800/30 opacity-40" : "bg-gray-800/50"}`}
            >
              {/* スライドするピル */}
              <div
                className="absolute top-1 bottom-1 w-1/3 bg-indigo-600 rounded-md shadow-lg shadow-indigo-900/50 transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${levelIndex * 100}%)` }}
              />
              {levels.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    if (!isGuest) {
                      setLevel(l);
                      posthog.capture("level_changed", { level: l });
                    }
                  }}
                  disabled={isGuest}
                  className={`relative z-10 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                    level === l ? "text-white" : "text-gray-400 hover:text-gray-200"
                  } ${isGuest ? "cursor-not-allowed" : ""}`}
                >
                  {labels[l]}
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-gray-500 mt-2 h-4 transition-all duration-200">
              {isGuest ? "ログインするとレベル設定が利用できます" : descriptions[level]}
            </p>
          </div>
        );
      })()}

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {/* キャラ未選択時 */}
        {!persona && (
          <div className="text-center text-gray-500 mt-16 text-base">
            <p className="text-4xl mb-4">🎭</p>
            <p>会話相手のキャラクターを選んでください</p>
            <Link
              href="/personas"
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-base rounded-lg transition-colors"
            >
              キャラクターを選ぶ
            </Link>
          </div>
        )}

        {/* キャラ選択済み・会話未開始（録音・処理中は非表示） */}
        {persona && messages.length === 0 && status === "idle" && !transcribing && (
          <div className="text-center text-gray-500 mt-16 text-base">
            <p className="text-4xl mb-4">🎙️</p>
            <p>下のボタンをタップして {persona.name} と話してみよう！</p>
            <p className="mt-1 text-sm text-gray-600">マイクへのアクセス許可が必要です</p>
          </div>
        )}

        {/* メッセージ一覧 */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-base font-bold mr-2 flex-shrink-0 mt-1">
                {persona?.name.charAt(0).toUpperCase() ?? "A"}
              </div>
            )}
            <div className="flex flex-col max-w-[80%]">
              <div
                className={`px-4 py-3 rounded-2xl text-base leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-gray-800 text-gray-100 rounded-tl-sm"
                }`}
              >
                {msg.text}
                {/* AI メッセージの日本語訳 */}
                {msg.role === "assistant" && msg.translation && (
                  <p className="mt-2 pt-2 border-t border-gray-700 text-sm text-gray-400 leading-relaxed">
                    {msg.translation}
                  </p>
                )}
              </div>
              {/* 「これ言えなかった」ボタン（ユーザー発話のみ、余白領域に追加） */}
              {msg.role === "user" && (
                <div className="flex justify-end mt-1 mr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSavePhraseReferenceText(msg.text);
                      setSavePhraseOpen(true);
                      posthog.capture("save_phrase_modal_opened", {
                        source: "user_bubble",
                      });
                    }}
                    className="text-xs text-gray-500 hover:text-indigo-300 transition-colors px-1.5 py-0.5 rounded"
                  >
                    これ言えなかった
                  </button>
                </div>
              )}
              {/* フィードバックボタン（AI メッセージのみ） */}
              {msg.role === "assistant" && (
                <div className="flex gap-1 mt-1 ml-1">
                  {/* 👍 選択中：背景+リング強調 / 未選択：薄いグレー */}
                  <button
                    type="button"
                    onClick={() => handleFeedback(msg.id, "positive")}
                    className={`px-1.5 py-0.5 rounded text-sm transition-all ${
                      feedback[msg.id] === "positive"
                        ? "bg-indigo-900/50 text-indigo-300 ring-1 ring-indigo-500/60"
                        : "text-gray-600 hover:text-gray-400 hover:bg-gray-800/50"
                    }`}
                    aria-label="良い返答"
                  >
                    👍
                  </button>
                  {/* 👎 選択中：背景+リング強調 / 未選択：薄いグレー */}
                  <button
                    type="button"
                    onClick={() => handleFeedback(msg.id, "negative")}
                    className={`px-1.5 py-0.5 rounded text-sm transition-all ${
                      feedback[msg.id] === "negative"
                        ? "bg-red-900/50 text-red-300 ring-1 ring-red-500/60"
                        : "text-gray-600 hover:text-gray-400 hover:bg-gray-800/50"
                    }`}
                    aria-label="悪い返答"
                  >
                    👎
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* オンデマンドサジェスト（Sprint 6 改訂 / プル型）
            ユーザーが「フレーズのヒント」ボタンを押したときだけ展開する。
            `timing` は会話履歴の有無で `before_chat` / `during_chat` を切替。 */}
        <SuggestPanel
          timing={suggestTiming}
          active={showSuggestPanel}
          personaId={persona?.id ?? null}
          recentMessages={recentMessages}
          hintJaText=""
          voiceId={selectedVoiceId ?? persona?.voice_id ?? null}
          isGuest={isGuest}
          onPrefill={handlePrefill}
          onClose={handleCloseSuggest}
        />

        {/* Whisper認識中：ユーザー側プレースホルダー */}
        {transcribing && (
          <div className="flex justify-end">
            <div className="bg-indigo-600/60 px-4 py-3 rounded-2xl rounded-tr-sm flex items-center gap-1.5">
              <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* Claude処理中：AI側ローディング（ユーザー発言確定後のみ） */}
        {status === "processing" && !transcribing && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-base font-bold mr-2 flex-shrink-0">
              {persona?.name.charAt(0).toUpperCase() ?? "A"}
            </div>
            <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* 利用上限バナー */}
      {quotaExceeded && (
        <div className="mb-3 px-4 py-3 bg-amber-900/60 border border-amber-700 rounded-lg text-amber-300 text-base">
          <p className="font-medium">現在、サービスの月間利用上限に達しています。</p>
          <p className="text-sm mt-1 text-amber-400">
            月初めにリセットされます。しばらくお待ちください。
          </p>
        </div>
      )}

      {/* エラー表示 */}
      {errorMsg && (
        <div className="mb-3 px-4 py-2 bg-red-900/60 border border-red-700 rounded-lg text-red-300 text-base flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:text-red-200 ml-3 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* プレフィル中バナー（[このフレーズで話す]の結果）。
          次に録音して話せば id 突合で phrase_used_in_chat を発火する。*/}
      {pendingPrefill && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-indigo-800/50 bg-indigo-950/60 px-3 py-2 text-sm">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-indigo-300">次に話す</p>
            <p className="mt-0.5 text-gray-100 break-words">{pendingPrefill.en_text}</p>
          </div>
          <button
            type="button"
            onClick={() => setPendingPrefill(null)}
            className="text-xl leading-none text-gray-400 hover:text-white"
            aria-label="プレフィルをキャンセル"
          >
            ×
          </button>
        </div>
      )}

      {/* フレーズのヒント（Sprint 6 改訂：プル型サジェスト） */}
      {canRequestSuggest && !showSuggestPanel && (
        <div className="flex justify-center pb-1">
          <button
            type="button"
            onClick={handleRequestSuggest}
            className="rounded-full border border-indigo-700/60 bg-indigo-950/40 hover:bg-indigo-900/60 px-4 py-1.5 text-xs text-indigo-200 transition-colors"
            aria-label="英語のフレーズのヒントをもらう"
          >
            💡 フレーズのヒント
          </button>
        </div>
      )}

      {/* 録音ボタン */}
      <div className="py-6 flex flex-col items-center gap-3">
        <p className="text-sm text-gray-500">{statusLabel[status]}</p>
        {/* ゲスト利用カウンター */}
        {isGuest && (
          <p
            className={`text-xs font-medium ${
              guestRemaining <= 0
                ? "text-red-400"
                : guestRemaining <= 1
                  ? "text-amber-400"
                  : "text-gray-500"
            }`}
          >
            {guestRemaining <= 0
              ? "利用上限に達しました"
              : `残り ${guestRemaining}/${GUEST_LIMIT} 回`}
          </p>
        )}
        <button
          disabled={isButtonDisabled}
          type="button"
          onClick={() => {
            if (status === "idle") {
              // 録音開始時はサジェストパネルを閉じる（視線を録音ボタンに戻す / プル型 UX）
              setShowSuggestPanel(false);
              startRecording();
            } else if (status === "recording") stopRecording();
          }}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200
            focus:outline-none focus:ring-4 focus:ring-indigo-500/50
            ${
              isButtonDisabled
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : status === "recording"
                  ? "bg-red-600 text-white recording-pulse cursor-pointer"
                  : "bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white cursor-pointer shadow-lg shadow-indigo-900/50"
            }
          `}
          aria-label={status === "recording" ? "録音停止" : "録音開始"}
        >
          {status === "recording" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8"
              viewBox="0 0 24 24"
              fill="currentColor"
              role="img"
              aria-label="停止アイコン"
            >
              <title>停止</title>
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8"
              viewBox="0 0 24 24"
              fill="currentColor"
              role="img"
              aria-label="マイクアイコン"
            >
              <title>マイク</title>
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9v2h6v-2h-2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
            </svg>
          )}
        </button>
      </div>

      {/* 「これ言えなかった」モーダル
       * voiceId：認証ユーザーは voice_sessions、ゲストは localStorage 由来。どちらも無ければ
       * persona.voice_id（デフォルトは Bella）にフォールバックして「分身の声未設定でも体験だけは試せる」状態を担保する。 */}
      <SavePhraseModal
        open={savePhraseOpen}
        onRequestClose={() => setSavePhraseOpen(false)}
        prefillJaText=""
        referenceUserText={savePhraseReferenceText}
        voiceId={selectedVoiceId ?? persona?.voice_id ?? null}
        isGuest={isGuest}
      />

      {/* ゲスト利用上限モーダル */}
      {showGuestLimitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full text-center space-y-4">
            <div className="text-2xl">🎉</div>
            <h2 className="text-lg font-semibold text-white">
              {GUEST_LIMIT}往復の会話を体験いただけました！
            </h2>
            <p className="text-gray-400 text-base">
              続けるにはログインが必要です。 ログインすると会話履歴も保存されます。
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() =>
                  posthog.capture("signup_cta_clicked", {
                    source: "guest_limit_modal",
                    action: "login",
                  })
                }
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-base font-medium transition-colors"
              >
                ログインする
              </Link>
              <Link
                href="/login?mode=signup"
                onClick={() =>
                  posthog.capture("signup_cta_clicked", {
                    source: "guest_limit_modal",
                    action: "signup",
                  })
                }
                className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-base font-medium transition-colors"
              >
                新規登録（無料）
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
