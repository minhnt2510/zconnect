export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.NEXT_PUBLIC_API_BASE_URL ||
  '/api'

/**
 * Backend origin derived from env vars, used to resolve /uploads/ to the correct
 * backend domain in production. Falls back to empty string in dev (Vite proxy handles it).
 */
export const BACKEND_ORIGIN: string = (() => {
  const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.NEXT_PUBLIC_SOCKET_URL
  if (socketUrl && /^https?:\/\//i.test(socketUrl)) {
    try { return new URL(socketUrl).origin } catch { /* ignore */ }
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.NEXT_PUBLIC_API_BASE_URL
  if (apiBase && /^https?:\/\//i.test(apiBase)) {
    try { return new URL(apiBase).origin } catch { /* ignore */ }
  }
  return ''
})()
