import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // id は既存インストールユーザーの識別子を維持するため変更しない（start_url を動かしても別アプリ扱いにさせない）。
    id: "/",
    // scope は "/" のまま維持し、アプリ内からマーケ用 LP（"/"）にも遷移可能にする。
    scope: "/",
    name: "MyVoiceLab",
    short_name: "MyVoiceLab",
    description: "AI と声で話して、残す。声で生活する、新しいかたち。",
    // PWA / TWA 起動時は LP を経由せず直接 /diary に直行する。
    // next-intl の localePrefix="as-needed" により、JA 既定ルートは prefix なしで "/diary" に解決される。
    start_url: "/diary",
    display: "standalone",
    // Quiet Journal のダーク墨色で起動スプラッシュ・テーマを統一する。
    // Light テーマ常用ユーザーには起動直後のみダークが見えるが、ブランド基調を優先する。
    background_color: "#121212",
    theme_color: "#121212",
    orientation: "portrait",
    lang: "ja",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
