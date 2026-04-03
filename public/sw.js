// VoiceLab Service Worker
// ホーム画面追加（PWA）のために最低限必要な SW
// Phase 1 ではオフラインキャッシュなし

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// fetch ハンドラ（Chrome の PWA インストール要件）
// API ルートはバイパス：POST body（音声 FormData）はストリームで一度しか読めないため
// SW が横取りして再 fetch すると body が消費済みになり音声認識失敗の原因になる
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) return;
  event.respondWith(fetch(event.request));
});
