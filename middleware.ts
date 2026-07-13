import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Basic認証。DASHBOARD_USER / DASHBOARD_PASS を設定すると有効になる。
 * 未設定の場合は認証なし（ローカル開発用）。本番では必ず設定すること。
 */
export function middleware(req: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;
  if (!user || !pass) return NextResponse.next();

  const header = req.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, p] = atob(encoded).split(":");
    if (u === user && p === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="seo-dashboard"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
