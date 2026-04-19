"use client";

// 使いかた 01「声で話す」用の軽量ビジュアル。
// 波形が脈打つだけのシンプルなモーションで、入力が「声」であることを即座に伝える。
export default function StepTalk() {
  return (
    <div className="relative w-full h-[120px] rounded-xl bg-[var(--bg-elevated)]/60 border border-[var(--border)] overflow-hidden flex items-center justify-center gap-1">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-[var(--fg-muted)]/60"
          style={{
            height: `${20 + ((i * 13) % 60)}%`,
            animation: `stepWave ${0.9 + (i % 3) * 0.2}s ease-in-out ${i * 0.07}s infinite alternate`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes stepWave {
          0% { transform: scaleY(0.3); opacity: 0.5; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
