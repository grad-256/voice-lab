"use client";

// マウント状態を追跡する Ref を返す共通 hook。
// 非同期コールバックが unmount 後に setState を呼んで React の警告を出したり、
// 参照切れの state を上書きするのを防ぐためのガード用途。
//
// 使い方：
//   const mountedRef = useMountedRef();
//   const data = await fetch(...);
//   if (!mountedRef.current) return;
//   setState(data);
//
// 重複していた `const mountedRef = useRef(true); useEffect(() => { ... })` を集約。

import { type MutableRefObject, useEffect, useRef } from "react";

export function useMountedRef(): MutableRefObject<boolean> {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}
