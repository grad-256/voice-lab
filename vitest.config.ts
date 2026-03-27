import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			// tsconfig の "@/*": ["./*"] と同じ解決ルールを vitest に適用
			"@": path.resolve(__dirname, "."),
		},
	},
	test: {
		// Node.js 22 の組み込み fetch / FormData / Blob を使用
		environment: "node",
		// セットアップファイル（環境変数・モックのリセット）
		setupFiles: ["./vitest.setup.ts"],
		// テストファイルのパターン（ユニット + インテグレーション）
		include: ["lib/**/*.test.ts", "app/api/**/*.integration.test.ts"],
	},
});
