import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function safePublicConfig(): boolean {
  if (!url || !key || key.startsWith("sb_secret_")) return false;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(
        import.meta.env.DEV &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      )
    )
      return false;
    if (key.startsWith("eyJ")) {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") return false;
    }
    return true;
  } catch {
    return false;
  }
}
export const supabase = safePublicConfig()
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export const localPreviewAvailable =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_PREVIEW === "true";
