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
// キャッシュなし・ネットワークをそのままパススルー
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
