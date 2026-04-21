"use client";

// Chapter 系譜の下罫線パスワード入力。uppercase ラベル + mono 入力で
// "書物の註釈欄" のリズムを作る。/me/password と /reset-password で共有。
//
// パスワード入力専用（eye 切替を内蔵）。テキスト入力には流用しない。

import { Eye, EyeOff } from "lucide-react";

const MONO_FAMILY = "var(--font-mono), ui-monospace, monospace";

type UnderlineFieldProps = {
  id: string;
  /** uppercase ラベル（9px / 0.3em tracking） */
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** ブラウザの自動補完属性 */
  autoComplete: "new-password" | "current-password";
  /** 表示／非表示の現在値 */
  isVisible: boolean;
  onToggleVisibility: () => void;
  /** 入力下に出す注記（例：「6文字以上」） */
  sub?: string;
  /** スクリーンリーダー用ラベル */
  showLabel: string;
  hideLabel: string;
  /** HTML5 minLength。サブ注記の文言と整合するよう呼び出し側で指定する。 */
  minLength: number;
};

export function UnderlineField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  isVisible,
  onToggleVisibility,
  sub,
  showLabel,
  hideLabel,
  minLength,
}: UnderlineFieldProps) {
  return (
    <div className="py-4" style={{ borderBottom: "0.5px solid var(--border)" }}>
      <label
        htmlFor={id}
        className="block text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-muted)]"
      >
        {label}
      </label>
      <div className="flex items-center gap-2 mt-1">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          placeholder={placeholder}
          minLength={minLength}
          autoComplete={autoComplete}
          className={`flex-1 bg-transparent border-0 outline-none text-base sm:text-lg text-[var(--fg)] placeholder:text-[var(--fg-subtle)] ${
            isVisible ? "tracking-wider" : "tracking-[0.18em]"
          }`}
          style={{ fontFamily: MONO_FAMILY }}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={isVisible ? hideLabel : showLabel}
          className="text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] transition-colors"
        >
          {isVisible ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
        </button>
      </div>
      {sub && <div className="text-xs sm:text-sm text-[var(--fg-muted)] mt-1">{sub}</div>}
    </div>
  );
}
