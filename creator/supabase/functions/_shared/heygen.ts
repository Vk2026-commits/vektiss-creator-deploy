import { z } from "zod";
import {
  PublicError,
  type AvatarCatalog,
  type CatalogAvatar,
  type ProviderVoice,
  type VoiceCatalog,
} from "./avatar-contract.ts";

const optionalText = z.string().nullable().optional();
const lookSchema = z.object({
  id: z.string().min(1).max(300),
  name: z.string().max(300),
  preview_image_url: optionalText,
  default_voice_id: optionalText,
  status: z.string().optional(),
  supported_api_engines: z.array(z.string()).max(20).optional(),
});
const voiceSchema = z.object({
  voice_id: z.string().min(1).max(300),
  name: z.string().max(300),
  language: optionalText,
});
const pagination = { has_more: z.boolean(), next_token: optionalText };

export interface AvatarCatalogProvider {
  readonly id: "heygen";
  verify(): Promise<{ accountLabel: string }>;
  listAvatars(
    cursor: string | null,
    ownership: "private" | "public",
  ): Promise<AvatarCatalog>;
  listVoices(
    cursor: string | null,
    type: "private" | "public",
  ): Promise<VoiceCatalog>;
  getAvatar(id: string): Promise<CatalogAvatar>;
  getVoice(id: string): Promise<ProviderVoice>;
}

function thumbnail(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const trusted = ["heygen.com", "heygen.ai"].some(
      (domain) =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
    return url.protocol === "https:" &&
      trusted &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function mapLook(raw: z.infer<typeof lookSchema>): CatalogAvatar {
  return {
    provider_avatar_id: raw.id,
    name: raw.name,
    thumbnail_url: thumbnail(raw.preview_image_url),
    default_voice_id: raw.default_voice_id ?? null,
    engines: raw.supported_api_engines ?? [],
    status:
      raw.status === "completed" || raw.status === "ready"
        ? "ready"
        : raw.status === "failed"
          ? "error"
          : raw.status === "disabled"
            ? "disabled"
            : "processing",
  };
}
function mapVoice(raw: z.infer<typeof voiceSchema>): ProviderVoice {
  return {
    provider_voice_id: raw.voice_id,
    name: raw.name,
    language: raw.language ?? null,
  };
}
function nextPage(
  page: { has_more: boolean; next_token?: string | null },
  previous: string | null,
) {
  if (!page.has_more) return null;
  if (!page.next_token || page.next_token === previous)
    throw new PublicError(
      "PROVIDER_RESPONSE",
      "HeyGen returned an incomplete catalog page. Try again shortly.",
      502,
    );
  return page.next_token;
}

export class HeyGenCatalog implements AvatarCatalogProvider {
  readonly id = "heygen" as const;
  constructor(
    private apiKey: string,
    private fetcher: typeof fetch = fetch,
  ) {}
  private async request(
    path: string,
    query?: URLSearchParams,
  ): Promise<unknown> {
    const url = new URL(path, "https://api.heygen.com");
    if (query) url.search = query.toString();
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { "X-Api-Key": this.apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
    } catch {
      throw new PublicError(
        "PROVIDER_UNAVAILABLE",
        "HeyGen did not respond. Please try again.",
        502,
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new PublicError(
        "PROVIDER_AUTH",
        "HeyGen could not authorize this request. Reconnect with an API key that has access to your avatars and voices.",
        401,
      );
    if (response.status === 429)
      throw new PublicError(
        "PROVIDER_RATE_LIMIT",
        "HeyGen is busy with this account. Wait a moment and try again.",
        429,
      );
    if (response.status === 404)
      throw new PublicError(
        "PROVIDER_NOT_FOUND",
        "This avatar or voice is no longer available in the connected HeyGen account.",
        404,
      );
    if (!response.ok)
      throw new PublicError(
        "PROVIDER_UNAVAILABLE",
        "HeyGen could not complete this request. Please try again.",
        502,
      );
    try {
      return await response.json();
    } catch {
      throw new PublicError(
        "PROVIDER_RESPONSE",
        "HeyGen returned an unreadable response. Please try again.",
        502,
      );
    }
  }
  async verify() {
    const raw = z
      .object({ data: z.object({ username: z.string().min(1).max(200) }) })
      .parse(await this.request("/v3/users/me"));
    return { accountLabel: raw.data.username };
  }
  async listAvatars(cursor: string | null, ownership: "private" | "public") {
    const params = new URLSearchParams({ limit: "50", ownership });
    if (cursor) params.set("token", cursor);
    const raw = z
      .object({ data: z.array(lookSchema).max(50), ...pagination })
      .parse(await this.request("/v3/avatars/looks", params));
    return { items: raw.data.map(mapLook), next_token: nextPage(raw, cursor) };
  }
  async listVoices(cursor: string | null, type: "private" | "public") {
    const params = new URLSearchParams({ limit: "100", type });
    if (cursor) params.set("token", cursor);
    const raw = z
      .object({ data: z.array(voiceSchema).max(100), ...pagination })
      .parse(await this.request("/v3/voices", params));
    return { items: raw.data.map(mapVoice), next_token: nextPage(raw, cursor) };
  }
  async getAvatar(id: string) {
    const raw = z
      .object({ data: lookSchema })
      .parse(await this.request(`/v3/avatars/looks/${encodeURIComponent(id)}`));
    if (raw.data.id !== id)
      throw new PublicError(
        "PROVIDER_RESPONSE",
        "HeyGen returned a different avatar. Please refresh the catalog.",
        502,
      );
    return mapLook(raw.data);
  }
  async getVoice(id: string) {
    const raw = z
      .object({ data: voiceSchema })
      .parse(await this.request(`/v3/voices/${encodeURIComponent(id)}`));
    if (raw.data.voice_id !== id)
      throw new PublicError(
        "PROVIDER_RESPONSE",
        "HeyGen returned a different voice. Please refresh the catalog.",
        502,
      );
    return mapVoice(raw.data);
  }
}
