import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Use current origin in browser so this works on any deployment (localhost, Vercel, custom domain)
  // without needing NEXT_PUBLIC_APP_URL to be set at build time.
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
});

export const {
  signIn,
  signOut,
  useSession,
  getSession,
} = authClient;
