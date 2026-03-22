import { NextRequest, NextResponse } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import type { auth } from "@/lib/auth";

type Session = typeof auth.$Infer.Session;

// Routes that don't require authentication (guest-accessible)
const PUBLIC_ROUTES = ["/login", "/api/auth", "/dashboard", "/products", "/suppliers", "/billing", "/report", "/stores", "/assets", "/delivery", "/po-logs", "/upload-history"];
// Routes that require admin role
const ADMIN_ONLY_ROUTES = ["/users", "/settings"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
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

  // No session → redirect to login
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
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
