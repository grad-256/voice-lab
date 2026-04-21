// Chapter 系譜の細線区切り。ink を 50% で敷くため Light/Dark 両方で "淡い罫線" になる。

import type { CSSProperties } from "react";

type RuleProps = {
  /** 線の長さ。デフォルト 40px（短いほど「章題の下線」感が強まる） */
  w?: number;
  /** 縦マージン（上下）。デフォルト 22px */
  mv?: number;
};

export function Rule({ w = 40, mv = 22 }: RuleProps) {
  const style: CSSProperties = {
    width: w,
    height: 1,
    backgroundColor: "var(--fg)",
    opacity: 0.5,
    margin: `${mv}px 0`,
  };
  return <div style={style} aria-hidden />;
}
