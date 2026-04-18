// MyVoiceLab PWA Service Worker
// PWA インストール可能判定（Chrome / Android WebAPK）を満たすための最小構成
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Android WebAPK minter は「fetch ハンドラがあり、ナビゲーションに応答できる」ことを
// オフライン耐性の証として要求する。キャッシュは積まず、ネットワーク直通で通すだけの
// pass-through ハンドラ。失敗時のみテキストを返す最小フォールバック。
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response("オフラインです。ネットワーク接続を確認してください。", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
    )
  );
});
