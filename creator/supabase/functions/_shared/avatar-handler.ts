import { z } from "zod";
import { avatarCommandSchema, PublicError } from "./avatar-contract.ts";
import type { AvatarService } from "./avatar-service.ts";

async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new PublicError("CONTENT_TYPE", "Send JSON for this request.", 415);
  if (!request.body)
    throw new PublicError("INVALID_INPUT", "A request is required.");
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new PublicError("TOO_LARGE", "This request is too large.", 413);
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new PublicError("INVALID_INPUT", "The request could not be read.");
  }
}

export function createAvatarHandler(options: {
  appOrigin: string;
  authenticate: (token: string) => Promise<string | null>;
  service: AvatarService;
}) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers = new Headers({
      "content-type": "application/json",
      "cache-control": "no-store",
      vary: "Origin",
      "x-content-type-options": "nosniff",
    });
    if (origin && origin !== options.appOrigin)
      return new Response(
        JSON.stringify({
          error: { code: "ORIGIN", message: "Origin not allowed." },
        }),
        { status: 403, headers },
      );
    if (origin) headers.set("access-control-allow-origin", origin);
    headers.set(
      "access-control-allow-headers",
      "authorization, apikey, content-type, x-client-info",
    );
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    try {
      if (request.method !== "POST")
        throw new PublicError("METHOD", "Use POST for this operation.", 405);
      const auth = request.headers.get("authorization");
      if (!auth?.startsWith("Bearer "))
        throw new PublicError("AUTH", "Sign in to manage your avatars.", 401);
      const userId = await options.authenticate(auth.slice(7));
      if (!userId)
        throw new PublicError(
          "AUTH",
          "Your session expired. Sign in again.",
          401,
        );
      const command = avatarCommandSchema.parse(await readBody(request));
      const result = await options.service.execute(userId, command);
      if(result instanceof Response){
        const downloadHeaders=new Headers(headers);
        result.headers.forEach((value,key)=>downloadHeaders.set(key,value));
        return new Response(result.body,{status:result.status,headers:downloadHeaders});
      }
      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (error) {
      // Never reflect provider response bodies, keys, SQL errors, or Zod input values.
      const safe =
        error instanceof PublicError
          ? error
          : error instanceof z.ZodError
            ? new PublicError(
                "INVALID_INPUT",
                "Some connection details are invalid. Check them and try again.",
              )
            : new PublicError(
                "UNAVAILABLE",
                "Avatar management is temporarily unavailable. Please try again.",
                503,
              );
      return new Response(
        JSON.stringify({ error: { code: safe.code, message: safe.message } }),
        { status: safe.status, headers },
      );
    }
  };
}
