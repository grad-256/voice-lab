// MyVoiceLab PWA Service Worker
// PWA インストール可能判定（Chrome）を満たすための最小構成
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
