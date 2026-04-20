import { routing } from "@/i18n/routing";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

// next-intl のロケール判定ミドルウェア（URL 書き換え / locale cookie 設定）
const intlMiddleware = createIntlMiddleware(routing);

// AuthDialog 導入後は、middleware で /login に強制リダイレクトしない方針。
// 保護ページは AuthGate（クライアント側）でダイアログ自動オープン → 閉じたら /app へ退避する。
// middleware は「/login 直アクセス → /app」の正規化と、ロケール処理・Supabase セッション更新に絞る。

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
  // 0) 英語版の privacy / terms が未整備のため、/en/* アクセスを JA デフォルトに寄せる。
  //    NEXT_LOCALE cookie も ja に書き戻しておき、次リクエストでの再リダイレクトを防ぐ。
  //    EN 版 legal docs 公開時にこのブロックと layout の LocaleSwitcher コメントアウトを同時解除する。
  const pathname = request.nextUrl.pathname;
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/en" ? "/" : pathname.slice(3);
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.cookies.set("NEXT_LOCALE", "ja", { path: "/" });
    return redirectResponse;
  }

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

  // getUser() は毎回サーバー検証する。戻り値自体は middleware では使わないが、
  // ここで Supabase のトークンリフレッシュと cookie 更新（setAll 経由）が走るので呼び出し必須。
  await supabase.auth.getUser();

  const bare = stripLocale(request.nextUrl.pathname);
  const localeSegment = getLocaleSegment(request.nextUrl.pathname);

  // 3) /login は廃止方針（AuthDialog が全ページで代替）。直アクセスされたら常に /app へ寄せる。
  //    ログイン状態を問わず /app にリダイレクトする（未ログインなら /app で AuthGate が発火）。
  if (bare === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = `${localeSegment}/app`;
    return NextResponse.redirect(url);
  }

  // 参考：未ログインで保護ページにアクセスした場合は middleware では何もしない。
  //       AuthGate（クライアント）がダイアログを自動オープンし、閉じたら /app に退避する。

  return response;
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon, api/, SW・マニフェスト・アイコンは除外
    "/((?!_next/static|_next/image|favicon.ico|api/|sw\\.js|manifest\\.webmanifest|icons/|icon.*\\.png|icon\\.svg).*)",
  ],
};
