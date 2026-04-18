import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl プラグインに i18n/request.ts の場所を教える
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Cloudflare Pages 向け設定
  // ローカル開発時はコメントアウト可
};

export default withNextIntl(nextConfig);
