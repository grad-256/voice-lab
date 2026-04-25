// Chapter 系譜の波形バー。録音中・再生中の視覚フィードバックに使う。
// 決定論的な sin/cos 合成で "毎レンダリング同じ形" にする（ハイドレーション安定）。

import type { CSSProperties } from "react";

type WavesProps = {
  /** バー本数。デフォルト 48 */
  n?: number;
  /** バー領域の高さ（px） */
  h?: number;
  /** アクティブ側の不透明度（非アクティブは 0.18 固定） */
  opacity?: number;
  /** アクティブ範囲の比率（0-1）。再生中の進捗表示に使える */
  active?: number;
  /** バー高さの倍率（0-1）。音量連動アニメに使う。デフォルト 1 */
  level?: number;
};

export function Waves({ n = 48, h = 22, opacity = 1, active = 1, level = 1 }: WavesProps) {
  const bars = Array.from({ length: n }, (_, i) => {
    const v = Math.abs(Math.sin(i * 1.7 + 0.3) * 0.55 + Math.cos(i * 0.83) * 0.35);
    return Math.max(0.14, v);
  });
  return (
    <div className="flex items-center gap-[1.5px] w-full" style={{ height: h }}>
      {bars.map((v, i) => {
        const style: CSSProperties = {
          flex: 1,
          height: `${Math.max(0.06, v * level) * 100}%`,
          backgroundColor: "var(--fg)",
          opacity: i < bars.length * active ? opacity : 0.18,
        };
        // バーの高さは決定論的に生成しており順序も不変のため、index key で安全。
        // biome-ignore lint/suspicious/noArrayIndexKey: deterministic fixed-length bars
        return <div key={i} style={style} />;
      })}
    </div>
  );
}
