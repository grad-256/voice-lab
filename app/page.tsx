export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

// ────────────────────────────────────────────────
// ペルソナプレビュー用データ
// ────────────────────────────────────────────────
const SAMPLE_PERSONAS = [
  {
    name: "Yuki",
    description: "フレンドリーな英会話パートナー。初心者にも優しく対応。",
    style: "カジュアル・励まし上手",
  },
  {
    name: "Alex",
    description: "ビジネス英語が得意なプロフェッショナル。面接練習にも対応。",
    style: "丁寧・ビジネスライク",
  },
  {
    name: "Mia",
    description: "旅行好きなアウトドア派。日常会話をリラックスして練習。",
    style: "明るい・話題豊富",
  },
];

export default async function LandingPage() {
  // ログイン済みユーザーはチャット画面にリダイレクト
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/app");
  }

  return (
    <main className="flex flex-col items-center w-full">
      {/* ヒーローセクション */}
      <section className="w-full max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
          AIで作った&quot;他者&quot;と、
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
            英語で話そう
          </span>
        </h1>
        <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          話す練習相手がいない。人前だと緊張する。
          <br />
          MyVoiceLab なら、自分だけの AI キャラクターと
          <br className="hidden sm:block" />
          いつでも気軽に英会話の練習ができます。
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/app"
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-lg shadow-lg shadow-indigo-900/40"
          >
            無料で試す
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium rounded-xl transition-colors text-lg"
          >
            ログイン
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-600">アカウント不要・5回まで無料で体験できます</p>
      </section>

      {/* 特徴セクション */}
      <section className="w-full max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-white text-center mb-12">MyVoiceLab の特徴</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl mb-4">🎙️</div>
            <h3 className="text-white font-semibold text-lg mb-2">声で会話</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              マイクに話しかけるだけ。AI が音声で返答してくれるので、リアルな会話練習ができます。
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl mb-4">🎭</div>
            <h3 className="text-white font-semibold text-lg mb-2">キャラクターを選べる</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              性格も声も異なるキャラクターから選択。自分に合った相手と練習できます。
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl mb-4">📝</div>
            <h3 className="text-white font-semibold text-lg mb-2">日本語訳つき</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              AI の返答には日本語訳がつくので、わからない表現もその場で確認できます。
            </p>
          </div>
        </div>
      </section>

      {/* ペルソナプレビューセクション */}
      <section className="w-full max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-white text-center mb-4">こんなキャラと話せます</h2>
        <p className="text-gray-500 text-center mb-10 text-sm">
          ログインすると、自分だけのキャラクターも作成できます
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {SAMPLE_PERSONAS.map((p) => (
            <div
              key={p.name}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col items-center text-center"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl mb-4">
                {p.name.charAt(0)}
              </div>
              <h3 className="text-white font-semibold text-lg">{p.name}</h3>
              <p className="text-xs text-indigo-400 mt-1 mb-3">{p.style}</p>
              <p className="text-gray-400 text-sm leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 下部 CTA */}
      <section className="w-full max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">さっそく始めてみよう</h2>
        <p className="text-gray-400 mb-8">アカウント登録なしで、すぐに英会話を体験できます。</p>
        <Link
          href="/app"
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-lg shadow-lg shadow-indigo-900/40"
        >
          無料で試す
        </Link>
      </section>
    </main>
  );
}
