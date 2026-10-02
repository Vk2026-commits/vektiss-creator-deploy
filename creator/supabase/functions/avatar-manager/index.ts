import { createClient } from "@supabase/supabase-js";
import { createAvatarHandler } from "../_shared/avatar-handler.ts";
import { createAvatarService } from "../_shared/avatar-service.ts";
import { credentialVault } from "../_shared/credential-crypto.ts";

// Runtime declaration also permits type-checking this function in the Node CI job.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

function required(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}
const db = createClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const vault = credentialVault(
  JSON.parse(required("PROVIDER_ENCRYPTION_KEYS")),
  required("PROVIDER_KEY_VERSION"),
);
const handler = createAvatarHandler({
  appOrigin: new URL(required("APP_ORIGIN")).origin,
  authenticate: async (token) => {
    const { data, error } = await db.auth.getUser(token);
    return error ? null : (data.user?.id ?? null);
  },
  service: createAvatarService(db, vault),
});
Deno.serve(handler);
