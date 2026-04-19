import { routing } from "@/i18n/routing";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

// next-intl のロケール判定ミドルウェア（URL 書き換え / locale cookie 設定）
const intlMiddleware = createIntlMiddleware(routing);

// ゲストでもアクセスできる完全一致パスの allowlist（locale プリフィクスを除いた裸のパス）。
// ここに「ない」ものは認証必須。
// 例：/diary は公開（ゲストも録音開始可）だが /diary/history は未掲載 → 認証必須。
const publicPaths = new Set<string>([
  "/",
  "/app",
  "/diary",
  "/login",
  "/privacy",
  "/terms",
  "/reset-password",
]);

// `/me` 以下（声選択・パスワード変更など）は認証必須なので publicPaths に入れない

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
  // 1) まず next-intl にロケール処理を委ねる。
  //    戻り値は「rewrite or redirect を含んだ」レスポンス。以降ここに cookie を重ねる。
  const response = intlMiddleware(request);

  // next-intl が明示的に redirect した場合（例：デフォルトロケールへの正規化）は即返す
  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  // 2) Supabase セッションを更新する（cookie 書き換えは response に積む）。
  //    next-intl が付与した rewrite / cookie を失わないよう、response を直接使う。
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

  // getUser() は毎回サーバー検証するため安全
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bare = stripLocale(request.nextUrl.pathname);
  const localeSegment = getLocaleSegment(request.nextUrl.pathname);

  // 3) 未ログイン かつ 保護パス → /login（現在ロケールのプリフィクスを維持）
  if (!user && !publicPaths.has(bare)) {
    const url = request.nextUrl.clone();
    url.pathname = `${localeSegment}/login`;
    return NextResponse.redirect(url);
  }

  // 4) ログイン済み かつ /login → /app
  if (user && bare === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = `${localeSegment}/app`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon, api/, SW・マニフェスト・アイコンは除外
    "/((?!_next/static|_next/image|favicon.ico|api/|sw\\.js|manifest\\.webmanifest|icons/|icon.*\\.png|icon\\.svg).*)",
  ],
};
