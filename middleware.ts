import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Supabase セッションをリフレッシュする
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
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // セッション取得（getUser() は毎回サーバー検証するため安全）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 未ログインでもアクセス可能なページ
  // /echo（場面再生の独立画面）と /settings/voice（分身の声作成）はゲストモード前提
  // （mvp-scope.md 5 章「ゲスト時の体験」）：録音→候補選択→localStorage 保存、
  // および場面からのフレーズ再生を未ログインで完走できるようにする。
  const publicPaths = [
    "/",
    "/app",
    "/echo",
    "/settings/voice",
    "/login",
    "/privacy",
    "/terms",
    "/reset-password",
  ];

  // 未ログイン かつ 公開ページ以外 → /login にリダイレクト
  if (!user && !publicPaths.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ログイン済み かつ /login → /app にリダイレクト
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon.ico, api/, SW・マニフェスト・アイコンは除外
    "/((?!_next/static|_next/image|favicon.ico|api/|sw\\.js|manifest\\.webmanifest|icon.*\\.png|icon\\.svg).*)",
  ],
};
