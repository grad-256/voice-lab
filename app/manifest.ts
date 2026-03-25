import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VoiceLab — AI 英会話パートナー",
    short_name: "VoiceLab",
    description: "声で話しかけると AI が音声で返してくれる英会話練習アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#4f46e5",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        // biome-ignore lint/suspicious/noExplicitAny: Next.js の型定義に purpose がないため
        purpose: "any maskable" as any,
      },
    ],
  };
}
