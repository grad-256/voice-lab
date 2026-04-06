"use client";

import { useEffect, useRef, useState } from "react";

// 会話シナリオ（ループ）
const CONVERSATION = [
  { role: "user", text: "Hello! Can we practice English together?" },
  {
    role: "assistant",
    text: "Of course! I'd love to help.",
    translation: "もちろん！喜んでお手伝いします。",
  },
  { role: "user", text: "Great! What should we talk about?" },
  {
    role: "assistant",
    text: "How about your hobbies?",
    translation: "趣味について話しましょうか？",
  },
  { role: "user", text: "I like traveling and cooking!" },
  {
    role: "assistant",
    text: "That's wonderful! Tell me more.",
    translation: "素晴らしい！もっと教えてください。",
  },
];

// メッセージが1つずつ出現 → 全部揃ったらリセットしてループ
export default function ChatDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const showNext = (index: number) => {
      if (index >= CONVERSATION.length) {
        // 全部表示 → 2秒待ってリセット
        timeout = setTimeout(() => {
          setVisibleCount(0);
          setShowTyping(false);
          timeout = setTimeout(() => showNext(0), 400);
        }, 2800);
        return;
      }

      const msg = CONVERSATION[index];

      if (msg.role === "assistant") {
        // AI はタイピングインジケーターを先に出す
        setShowTyping(true);
        timeout = setTimeout(() => {
          setShowTyping(false);
          setVisibleCount(index + 1);
          timeout = setTimeout(() => showNext(index + 1), 1200);
        }, 1000);
      } else {
        setVisibleCount(index + 1);
        timeout = setTimeout(() => showNext(index + 1), 900);
      }
    };

    // 初回は少し間を置いてスタート
    timeout = setTimeout(() => showNext(0), 600);
    return () => clearTimeout(timeout);
  }, []);

  // visibleCount か showTyping が変わったら最下部へスクロール
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // visibleCount / showTyping を参照することで deps として正当化
    void visibleCount;
    void showTyping;
    el.scrollTop = el.scrollHeight;
  }, [visibleCount, showTyping]);

  const messages = CONVERSATION.slice(0, visibleCount);

  return (
    <div
      className="w-full bg-gray-950 rounded-[32px] border border-gray-700/50 overflow-hidden flex flex-col h-[520px]"
      style={{
        boxShadow:
          "0 0 0 6px #111827, 0 0 0 7px rgba(99,102,241,0.15), 0 32px 64px rgba(0,0,0,0.8)",
      }}
    >
      {/* ステータスバー */}
      <div className="px-5 pt-3 pb-1 flex justify-between items-center text-[10px] text-gray-600">
        <span>9:41</span>
        <span>WiFi 100%</span>
      </div>

      <div className="flex flex-col px-3 pb-5 flex-1 min-h-0">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 py-2 border-b border-gray-800/50">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            Y
          </div>
          <div>
            <p className="text-white font-semibold text-xs leading-tight">Yuki</p>
            <p className="text-gray-500 text-[10px]">英会話パートナー</p>
          </div>
          {/* オンラインインジケーター */}
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* レベル */}
        <div className="flex gap-1 py-1.5 border-b border-gray-800/50">
          {["初級", "中級", "上級"].map((l, i) => (
            <div
              key={l}
              className={`flex-1 py-0.5 text-[11px] font-medium rounded text-center ${
                i === 0 ? "bg-indigo-600 text-white" : "text-gray-600"
              }`}
            >
              {l}
            </div>
          ))}
        </div>

        {/* メッセージエリア：固定高さ＋内部スクロール */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-3 scroll-smooth" style={{ scrollbarWidth: "none" }}>
          {messages.map((msg, i) => (
            <div
              key={`${i}-${msg.text}`}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fadeSlideUp`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-1 mr-1.5">
                  Y
                </div>
              )}
              <div className="max-w-[82%]">
                <div
                  className={`text-xs px-3 py-2 rounded-2xl leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-gray-800 text-gray-100 rounded-tl-sm"
                  }`}
                >
                  {msg.text}
                  {"translation" in msg && msg.translation && (
                    <p className="mt-1.5 pt-1.5 border-t border-gray-700 text-[10px] text-gray-400">
                      {msg.translation}
                    </p>
                  )}
                </div>
                {msg.role === "assistant" && (
                  <div className="flex gap-1 mt-1 ml-1">
                    <span className="px-1 py-0.5 rounded text-xs bg-indigo-900/50 text-indigo-300 ring-1 ring-indigo-500/60">
                      👍
                    </span>
                    <span className="px-1 py-0.5 rounded text-xs text-gray-600">👎</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* タイピングインジケーター */}
          {showTyping && (
            <div className="flex justify-start gap-1.5 animate-fadeSlideUp">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-1">
                Y
              </div>
              <div className="bg-gray-800 px-3 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {/* 録音ボタン */}
        <div className="flex flex-col items-center gap-2 pt-1">
          <p className="text-[10px] text-gray-600">タップして話しかける</p>
          <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9v2h6v-2h-2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
