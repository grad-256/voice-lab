// スクリーンショット撮影用デモページ（LP 用画像素材）
// URL を直接知っている人だけがアクセスできる非公開ページ

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DemoScreenshotPage() {
  const persona = { name: "Yuki" };

  const messages = [
    {
      id: "1",
      role: "user" as const,
      text: "Hello! Can we practice English together?",
    },
    {
      id: "2",
      role: "assistant" as const,
      text: "Of course! I'd love to help.",
      translation: "もちろん！喜んでお手伝いします。",
      feedback: "positive" as const,
    },
    {
      id: "3",
      role: "user" as const,
      text: "Great! What should we talk about?",
    },
    {
      id: "4",
      role: "assistant" as const,
      text: "How about your hobbies?",
      translation: "趣味について話しましょうか？",
      feedback: null,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      {/* モバイル風フレーム */}
      <div
        className="w-[390px] h-[700px] bg-gray-950 rounded-[40px] border border-gray-700/60 shadow-2xl shadow-black/80 overflow-hidden flex flex-col"
        style={{ boxShadow: "0 0 0 8px #111, 0 32px 64px rgba(0,0,0,0.8)" }}
      >
        {/* ステータスバー */}
        <div className="px-6 pt-4 pb-1 flex justify-between items-center text-xs text-gray-500">
          <span>9:41</span>
          <span className="flex gap-1 items-center">
            <span>●●●</span>
            <span>WiFi</span>
            <span>100%</span>
          </span>
        </div>

        {/* アプリ内コンテンツ */}
        <div className="flex flex-col flex-1 px-4 overflow-hidden">
          {/* ヘッダー */}
          <header className="flex items-center justify-between py-3 border-b border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base">
                Y
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Yuki</p>
                <p className="text-gray-500 text-xs">英会話パートナー</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500 px-2 py-1.5">キャラ変更</span>
              <span className="text-sm text-gray-500 px-2 py-1.5">設定</span>
            </div>
          </header>

          {/* レベル選択 */}
          <div className="flex gap-1 py-2 border-b border-gray-800/50">
            {["初級", "中級", "上級"].map((label, i) => (
              <div
                key={label}
                className={`flex-1 py-1 text-sm font-medium rounded-md text-center ${
                  i === 0 ? "bg-indigo-600 text-white" : "text-gray-500"
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* チャットエリア */}
          <div className="flex-1 overflow-hidden py-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold mr-2 flex-shrink-0 mt-1">
                    Y
                  </div>
                )}
                <div className="flex flex-col max-w-[78%]">
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-sm"
                        : "bg-gray-800 text-gray-100 rounded-tl-sm"
                    }`}
                  >
                    {msg.text}
                    {msg.role === "assistant" && msg.translation && (
                      <p className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 leading-relaxed">
                        {msg.translation}
                      </p>
                    )}
                  </div>
                  {msg.role === "assistant" && (
                    <div className="flex gap-1 mt-1 ml-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-sm ${
                          msg.feedback === "positive"
                            ? "bg-indigo-900/50 text-indigo-300 ring-1 ring-indigo-500/60"
                            : "text-gray-600"
                        }`}
                      >
                        👍
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-sm text-gray-600">👎</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 録音ボタンエリア */}
          <div className="py-5 flex flex-col items-center gap-3">
            <p className="text-xs text-gray-500">タップして話しかける</p>
            <button
              type="button"
              className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-900/50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9v2h6v-2h-2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
