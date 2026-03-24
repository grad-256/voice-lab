"use client";

import { useRef, useState, useCallback, useEffect } from "react";

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
  | "idle"       // 待機中
  | "recording"  // 録音中
  | "processing" // Whisper → Claude → ElevenLabs
  | "speaking";  // 音声再生中

// ────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2);
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 新メッセージが来たら自動スクロール
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ────────────────────────────────────────────────
  // 録音 開始
  // ────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // 録音終了後に処理パイプラインを起動
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        processAudio(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
    } catch {
      setErrorMsg("マイクへのアクセスが許可されていません");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ────────────────────────────────────────────────
  // 録音 停止
  // ────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setStatus("processing");
  }, []);

  // ────────────────────────────────────────────────
  // パイプライン: 音声 → テキスト → Claude → ElevenLabs → 再生
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

        // 2. Claude: テキスト → 返答
        const history = messages.map(({ role, text }) => ({
          role,
          content: text,
        }));

        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText, history }),
        });
        const { text: aiText, error: c_err } = await chatRes.json();
        if (c_err || !aiText) throw new Error(c_err ?? "AI 応答の取得に失敗しました");

        const aiMsg: Message = { id: uid(), role: "assistant", text: aiText };
        setMessages((prev) => [...prev, aiMsg]);

        // 3. ElevenLabs: テキスト → 音声
        const speakRes = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: aiText }),
        });
        if (!speakRes.ok) throw new Error("音声生成に失敗しました");

        const audioBuffer = await speakRes.arrayBuffer();
        const audioUrl = URL.createObjectURL(
          new Blob([audioBuffer], { type: "audio/mpeg" })
        );

        // 4. 自動再生
        setStatus("speaking");
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
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
    [messages]
  );

  // ────────────────────────────────────────────────
  // ステータスラベル
  // ────────────────────────────────────────────────
  const statusLabel: Record<Status, string> = {
    idle: "タップして話す",
    recording: "録音中... もう一度タップで停止",
    processing: "Emma が考えています...",
    speaking: "Emma が話しています...",
  };

  const isButtonDisabled = status === "processing" || status === "speaking";

  // ────────────────────────────────────────────────
  // レンダリング
  // ────────────────────────────────────────────────
  return (
    <main className="flex flex-col h-screen max-w-2xl mx-auto px-4">
      {/* ヘッダー */}
      <header className="py-4 border-b border-gray-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
          E
        </div>
        <div>
          <h1 className="font-semibold text-white">Emma</h1>
          <p className="text-xs text-gray-400">英会話パートナー · カナダ出身 25歳</p>
        </div>
        {status === "speaking" && (
          <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            話し中
          </span>
        )}
      </header>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-16 text-sm">
            <p className="text-4xl mb-4">🎙️</p>
            <p>下のボタンをタップして Emma と話してみよう！</p>
            <p className="mt-1 text-xs text-gray-600">マイクへのアクセス許可が必要です</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold mr-2 flex-shrink-0 mt-1">
                E
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

        {/* ローディング表示 */}
        {status === "processing" && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold mr-2 flex-shrink-0">
              E
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
          onMouseDown={startRecording}
          onMouseUp={status === "recording" ? stopRecording : undefined}
          onTouchStart={startRecording}
          onTouchEnd={status === "recording" ? stopRecording : undefined}
          onClick={status === "recording" ? stopRecording : undefined}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200
            focus:outline-none focus:ring-4 focus:ring-indigo-500/50
            ${isButtonDisabled
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : status === "recording"
              ? "bg-red-600 text-white recording-pulse cursor-pointer"
              : "bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white cursor-pointer shadow-lg shadow-indigo-900/50"
            }
          `}
          aria-label={status === "recording" ? "録音停止" : "録音開始"}
        >
          {status === "recording" ? (
            // 停止アイコン
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            // マイクアイコン
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9v2h6v-2h-2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z"/>
            </svg>
          )}
        </button>
      </div>
    </main>
  );
}
