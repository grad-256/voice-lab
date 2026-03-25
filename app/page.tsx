"use client";

import { type Persona, getPersonas } from "@/lib/personas";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

// ────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────
type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  text: string;
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recordingStartRef = useRef<number>(0);
  const processAudioRef = useRef<((blob: Blob) => Promise<void>) | null>(null);

  // URL パラメータからキャラを読み込む
  useEffect(() => {
    const personaId = searchParams.get("persona");
    if (!personaId) return;
    getPersonas()
      .then((list) => {
        const found = list.find((p) => p.id === personaId) ?? null;
        setPersona(found);
        setMessages([]); // キャラ切り替え時に会話をリセット
      })
      .catch(() => setErrorMsg("キャラクターの読み込みに失敗しました"));
  }, [searchParams]);

  // 自動スクロール
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length で意図的にトリガー
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ログアウト
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

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
          processAudioRef.current = null;
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
      }, remaining);
    } else {
      mediaRecorderRef.current?.stop();
      setStatus("processing");
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
        if (t_err || !userText) throw new Error(t_err ?? "音声認識に失敗しました");

        const userMsg: Message = { id: uid(), role: "user", text: userText };
        setMessages((prev) => [...prev, userMsg]);

        // 2. Claude: テキスト → 返答（キャラのシステムプロンプトを渡す）
        const history = messages.map(({ role, text }) => ({ role, content: text }));
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            history,
            systemPrompt: persona?.style_prompt,
          }),
        });
        const { text: aiText, error: c_err } = await chatRes.json();
        if (c_err || !aiText) throw new Error(c_err ?? "AI 応答の取得に失敗しました");

        const aiMsg: Message = { id: uid(), role: "assistant", text: aiText };
        setMessages((prev) => [...prev, aiMsg]);

        const isGoodbye = /\b(bye|goodbye)\b/i.test(userText);

        // 3. ElevenLabs: テキスト → 音声（キャラのボイス ID を渡す）
        const speakRes = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: aiText,
            voiceId: persona?.voice_id,
          }),
        });
        if (!speakRes.ok) throw new Error("音声生成に失敗しました");

        const audioBuffer = await speakRes.arrayBuffer();
        const audioUrl = URL.createObjectURL(new Blob([audioBuffer], { type: "audio/mpeg" }));

        // 4. 自動再生
        setStatus("speaking");
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (isGoodbye) setTimeout(() => setMessages([]), 3000);
          setStatus("idle");
        };
        audio.onerror = () => {
          setErrorMsg("音声の再生に失敗しました");
          setStatus("idle");
        };
        await audio.play();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "エラーが発生しました");
        setStatus("idle");
      }
    },
    [messages, persona]
  );

  useEffect(() => {
    processAudioRef.current = processAudio;
  }, [processAudio]);

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

  const isButtonDisabled = !persona || status === "processing" || status === "speaking";

  // ────────────────────────────────────────────────
  // レンダリング
  // ────────────────────────────────────────────────
  return (
    <main className="flex flex-col h-screen max-w-2xl mx-auto px-4">
      {/* ヘッダー */}
      <header className="py-4 border-b border-gray-800 flex items-center gap-3">
        {/* キャラアバター */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {persona ? persona.name.charAt(0).toUpperCase() : "?"}
        </div>

        {/* キャラ名 */}
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white truncate">{personaName}</h1>
          {persona ? (
            <p className="text-xs text-gray-400 truncate">{persona.style_prompt.slice(0, 40)}…</p>
          ) : (
            <p className="text-xs text-gray-400">キャラクターが選択されていません</p>
          )}
        </div>

        {/* 話し中インジケーター */}
        {status === "speaking" && (
          <span className="text-xs text-green-400 flex items-center gap-1 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            話し中
          </span>
        )}

        {/* キャラ切り替え & ログアウト */}
        <Link
          href="/personas"
          className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded flex-shrink-0"
        >
          キャラ変更
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded flex-shrink-0"
        >
          ログアウト
        </button>
      </header>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {/* キャラ未選択時 */}
        {!persona && (
          <div className="text-center text-gray-500 mt-16 text-sm">
            <p className="text-4xl mb-4">🎭</p>
            <p>会話相手のキャラクターを選んでください</p>
            <Link
              href="/personas"
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
            >
              キャラクターを選ぶ
            </Link>
          </div>
        )}

        {/* キャラ選択済み・メッセージなし */}
        {persona && messages.length === 0 && (
          <div className="text-center text-gray-500 mt-16 text-sm">
            <p className="text-4xl mb-4">🎙️</p>
            <p>下のボタンをタップして {persona.name} と話してみよう！</p>
            <p className="mt-1 text-xs text-gray-600">マイクへのアクセス許可が必要です</p>
          </div>
        )}

        {/* メッセージ一覧 */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold mr-2 flex-shrink-0 mt-1">
                {persona?.name.charAt(0).toUpperCase() ?? "A"}
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-gray-800 text-gray-100 rounded-tl-sm"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* ローディング */}
        {status === "processing" && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold mr-2 flex-shrink-0">
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

      {/* エラー表示 */}
      {errorMsg && (
        <div className="mb-3 px-4 py-2 bg-red-900/60 border border-red-700 rounded-lg text-red-300 text-sm flex items-center justify-between">
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

      {/* 録音ボタン */}
      <div className="py-6 flex flex-col items-center gap-3">
        <p className="text-xs text-gray-500">{statusLabel[status]}</p>
        <button
          disabled={isButtonDisabled}
          type="button"
          onClick={() => {
            if (status === "idle") startRecording();
            else if (status === "recording") stopRecording();
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
