// 404 ページ。Cloudflare Pages の Edge Runtime 要件を満たすために明示。
export const runtime = "edge";

export default function NotFound() {
  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-white mb-3">ページが見つかりません</h1>
      <p className="text-sm text-gray-400 mb-8">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <a
        href="/"
        className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
      >
        トップへ戻る
      </a>
    </main>
  );
}
