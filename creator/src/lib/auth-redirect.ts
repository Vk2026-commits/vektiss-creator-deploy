// Match the exact root URL registered in Supabase's redirect allowlist.
// Never carry access tokens, fragments, or arbitrary query parameters forward.
export function authRedirectUrl(origin: string): string {
  return new URL('/', origin).href;
}
