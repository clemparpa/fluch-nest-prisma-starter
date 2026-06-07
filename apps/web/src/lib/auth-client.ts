import { createAuthClient } from "better-auth/react"

// Omitting baseURL → better-auth resolves to `${window.location.origin}/api/auth`
// (see better-auth/dist/utils/url.mjs getBaseURL fallback). Same-origin in dev
// via Vite proxy, same-origin in prod via reverse-proxy.
export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient
