import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { creativeCommandSchema } from "../_shared/creative-contract.ts";
import { createCreativeService } from "../_shared/creative-service.ts";
import { credentialVault } from "../_shared/credential-crypto.ts";
import { PublicError } from "../_shared/avatar-contract.ts";
import { isAllowedAppOrigin } from "../_shared/app-origins.ts";
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (r: Request) => Promise<Response>): void;
};
const required = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw Error(`Missing ${key}`);
  return value;
};
const db = createClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const service = createCreativeService(
  db,
  credentialVault(
    JSON.parse(required("PROVIDER_ENCRYPTION_KEYS")),
    required("PROVIDER_KEY_VERSION"),
  ),
  Deno.env.get("CREATOR_CREATIVE_ENABLED") === "true",
);
Deno.serve(async (request) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  const origin = request.headers.get("origin");
  if (
    origin &&
    !isAllowedAppOrigin(
      origin,
      required("APP_ORIGIN"),
      Deno.env.get("CREATOR_ADDITIONAL_ORIGINS"),
    )
  )
    return new Response("{}", { status: 403, headers });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, x-client-info",
  );
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  try {
    if (request.method !== "POST")
      throw new PublicError("METHOD", "Use POST.", 405);
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token)
      throw new PublicError("AUTH", "Sign in to use creative tools.", 401);
    const auth = await db.auth.getUser(token);
    if (auth.error || !auth.data.user)
      throw new PublicError("AUTH", "Sign in again to continue.", 401);
    const reader = request.body?.getReader();
    if (!reader) throw new PublicError("INPUT", "A request is required.", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 7_100_000) {
        await reader.cancel();
        throw new PublicError("SIZE", "Upload an image under 5 MB.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const command = creativeCommandSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const result = await service.execute(auth.data.user.id, command);
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (error) {
    const safe =
      error instanceof PublicError
        ? error
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? new PublicError(
              "INPUT",
              "Check the form fields and image sizes.",
              400,
            )
          : new PublicError(
              "SERVICE",
              "Creative tools could not finish this request. Refresh saved jobs before trying again.",
              503,
            );
    return new Response(
      JSON.stringify({ error: { code: safe.code, message: safe.message } }),
      { status: safe.status, headers },
    );
  }
});
