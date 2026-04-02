"use client";

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirm) {
      setErrorMsg("パスワードが一致しません");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/login");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "エラーが発生しました";
      if (msg.includes("Auth session missing")) {
        setErrorMsg("リンクの有効期限が切れています。再度パスワードリセットをお試しください。");
      } else if (msg.includes("Password should be at least")) {
        setErrorMsg("パスワードは6文字以上で入力してください");
      } else {
        setErrorMsg("パスワードの更新に失敗しました。再度お試しください。");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center flex-1 px-4 bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            V
          </div>
          <h1 className="text-2xl font-bold text-white">パスワード再設定</h1>
          <p className="text-sm text-gray-400 mt-1">新しいパスワードを入力してください</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm text-gray-400 mb-1">
              新しいパスワード
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
                className="w-full px-4 py-3 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
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

          <div>
            <label htmlFor="confirm" className="block text-sm text-gray-400 mb-1">
              パスワード（確認）
            </label>
            <div className="relative">
              <input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="もう一度入力"
                minLength={6}
                className="w-full px-4 py-3 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="px-4 py-3 bg-red-900/60 border border-red-700 rounded-lg text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {loading ? "更新中..." : "パスワードを更新する"}
          </button>
        </form>
      </div>
    </main>
  );
}
