"use client";

// 静的プリレンダリングを無効化（Supabase クライアントはビルド時に初期化できないため）
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
      />
    </svg>
  );
}

// ────────────────────────────────────────────────
// ログイン / サインアップ / パスワードリセット 画面
// ────────────────────────────────────────────────
function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showGuestDialog, setShowGuestDialog] = useState(false);

  const switchMode = (next: "login" | "signup" | "forgot") => {
    setMode(next);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/app");
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Confirm email オフの場合はセッションが即発行されるのでリダイレクト
        if (data.session) {
          router.push("/app");
          router.refresh();
        } else {
          setSuccessMsg(
            "確認メールを送信しました。メールのリンクをクリックしてアカウントを有効化してください。"
          );
        }
      } else {
        // パスワードリセットメール送信
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccessMsg(
          "パスワードリセットメールを送信しました。メールのリンクからパスワードを再設定してください。"
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "エラーが発生しました";
      if (msg.includes("Invalid login credentials")) {
        setErrorMsg("メールアドレスまたはパスワードが正しくありません");
      } else if (msg.includes("Email not confirmed")) {
        setErrorMsg("メールアドレスが確認されていません。確認メールをご確認ください");
      } else if (msg.includes("User already registered")) {
        setErrorMsg("このメールアドレスはすでに登録されています");
      } else if (msg.includes("Password should be at least")) {
        setErrorMsg("パスワードは6文字以上で入力してください");
      } else {
        setErrorMsg("エラーが発生しました。しばらく経ってから再度お試しください。");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center flex-1 px-4 bg-gray-950">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            V
          </div>
          <h1 className="text-2xl font-bold text-white">MyVoiceLab</h1>
          <p className="text-base text-gray-400 mt-1">AI 音声会話パートナー</p>
        </div>

        {mode === "forgot" ? (
          /* パスワードリセットモード */
          <>
            <h2 className="text-base font-semibold text-white mb-1">パスワードをお忘れの方</h2>
            <p className="text-base text-gray-400 mb-6">
              登録済みのメールアドレスを入力してください。リセット用リンクをお送りします。
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-base text-gray-400 mb-1">
                  メールアドレス
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
                />
              </div>

              {errorMsg && (
                <div className="px-4 py-3 bg-red-900/60 border border-red-700 rounded-lg text-red-300 text-base">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="px-4 py-3 bg-green-900/60 border border-green-700 rounded-lg text-green-300 text-base">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors text-base"
              >
                {loading ? "送信中..." : "リセットメールを送信"}
              </button>

              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full text-base text-gray-400 hover:text-white transition-colors text-center"
              >
                ← ログインに戻る
              </button>
            </form>
          </>
        ) : (
          /* ログイン / 新規登録モード */
          <>
            {/* タブ */}
            <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "login" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                ログイン
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "signup" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                新規登録
              </button>
            </div>

            {/* フォーム */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-base text-gray-400 mb-1">
                  メールアドレス
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-base text-gray-400 mb-1">
                  パスワード
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="6文字以上"
                    minLength={6}
                    className="w-full px-4 py-3 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {/* エラー表示 */}
              {errorMsg && (
                <div className="px-4 py-3 bg-red-900/60 border border-red-700 rounded-lg text-red-300 text-base">
                  {errorMsg}
                </div>
              )}

              {/* 成功表示 */}
              {successMsg && (
                <div className="px-4 py-3 bg-green-900/60 border border-green-700 rounded-lg text-green-300 text-base">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors text-base"
              >
                {loading ? "処理中..." : mode === "login" ? "ログイン" : "アカウントを作成"}
              </button>

              {/* パスワードを忘れた方 */}
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="w-full text-base text-gray-500 hover:text-gray-300 transition-colors text-center"
                >
                  パスワードをお忘れの方
                </button>
              )}

              <div className="text-center">
                <span className="text-gray-500 text-base">または</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGuestDialog(true)}
                className="block w-full text-center py-2 text-base text-gray-400 hover:text-gray-200 transition-colors"
              >
                ログインせずに試す（5往復まで無料）
              </button>
            </form>
          </>
        )}
      </div>

      {/* ゲスト体験ダイアログ */}
      {showGuestDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-semibold text-white">ゲストとして試す</h2>
            <ul className="text-gray-300 text-base space-y-2">
              <li>・最大5往復まで無料体験できます</li>
              <li>・会話履歴は保存されません</li>
              <li>・続けて使うにはアカウント登録が必要です</li>
            </ul>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/app"
                className="w-full py-2 text-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-base font-medium transition-colors"
              >
                ゲストとして試す
              </Link>
              <button
                type="button"
                onClick={() => setShowGuestDialog(false)}
                className="w-full py-2 text-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-base transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
