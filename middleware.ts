import { routing } from "@/i18n/routing";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

// next-intl のロケール判定ミドルウェア（URL 書き換え / locale cookie 設定）
const intlMiddleware = createIntlMiddleware(routing);

// middleware の責務：ロケール処理・Supabase セッション更新・/login 正規化・非 LP に noindex。

function stripLocale(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  const [first, ...rest] = segments;
  if ((routing.locales as readonly string[]).includes(first)) {
    return rest.length === 0 ? "/" : `/${rest.join("/")}`;
  }
  return pathname;
}

function getLocaleSegment(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && (routing.locales as readonly string[]).includes(segments[0])) {
    return `/${segments[0]}`;
  }
  return "";
}

export async function middleware(request: NextRequest) {
  // next-intl にロケール処理を委ねる。以降ここに cookie を重ねる。
  const response = intlMiddleware(request);

  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  // Supabase セッションのトークンリフレッシュと cookie 更新。
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getAll/setAll の cookie 同期を発火させるため毎回呼ぶ。
  await supabase.auth.getUser();

  const bare = stripLocale(request.nextUrl.pathname);
  const localeSegment = getLocaleSegment(request.nextUrl.pathname);

  // /login は廃止（AuthDialog が代替）。直アクセスは /app に正規化。
  if (bare === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = `${localeSegment}/app`;
    return NextResponse.redirect(url);
  }

  // アルファ公開前：LP 以外に noindex, nofollow ヘッダ。robots.ts の二重防御。
  const NON_INDEXED_PREFIXES = [
    "/app",
    "/diary",
    "/me",
    "/pricing",
    "/faq",
    "/release-notes",
    "/reset-password",
    "/login",
  ];
  const isNonIndexed = NON_INDEXED_PREFIXES.some(
    (prefix) => bare === prefix || bare.startsWith(`${prefix}/`)
  );
  if (isNonIndexed) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon, api/, SW・マニフェスト・アイコンは除外
    "/((?!_next/static|_next/image|favicon.ico|api/|sw\\.js|manifest\\.webmanifest|icons/|icon.*\\.png|icon\\.svg).*)",
  ],
};
