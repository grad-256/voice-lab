import type { MetadataRoute } from "next";

// アルファ公開前：LP のみクロール許可。本公開時は disallow から該当パスを外す。
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://myvoicelab.app";

  const disallowedSuffixes = [
    "app",
    "diary",
    "me",
    "pricing",
    "faq",
    "release-notes",
    "reset-password",
    "login",
  ];

  const disallow: string[] = ["/api/"];
  for (const suffix of disallowedSuffixes) {
    disallow.push(`/${suffix}`);
    disallow.push(`/ja/${suffix}`);
    disallow.push(`/en/${suffix}`);
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ja", "/en"],
        disallow,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
