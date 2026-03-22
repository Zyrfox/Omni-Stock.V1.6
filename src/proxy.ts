import { NextRequest, NextResponse } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import type { auth } from "@/lib/auth";

type Session = typeof auth.$Infer.Session;

// Routes that bypass session check entirely (auth endpoints + static)
const AUTH_ROUTES = ["/login", "/api/auth", "/change-password"];
// Routes that require authentication (guests cannot access)
const ADMIN_ONLY_ROUTES = ["/users", "/settings"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth routes and static assets through immediately
  if (
    AUTH_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Get session via API — avoids importing Node.js-only `postgres` in Edge Runtime
  const { data: session } = await betterFetch<Session>(
    "/api/auth/get-session",
    {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    },
  );

  // No session → allow guest access, but block admin-only routes
  if (!session) {
    if (ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // All other routes: allow through as guest
    return NextResponse.next();
  }

  // Force password change for first-time users
  const mustChange = (session.user as { mustChangePassword?: boolean }).mustChangePassword;
  if (mustChange && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  // Admin-only routes
  if (ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    const userRole = (session.user as { role?: string }).role;
    if (userRole !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
