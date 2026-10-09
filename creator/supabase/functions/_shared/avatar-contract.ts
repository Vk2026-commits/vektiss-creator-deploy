import { z } from "zod";
import { testCommand } from './presenter-test.ts';

export const providerId = z.enum(["heygen"]);
const opaqueId = z.string().trim().min(1).max(300);
export const avatarStatus = z.enum([
  "ready",
  "processing",
  "error",
  "disabled",
]);
export const connectionSchema = z.object({
  id: z.string().uuid(),
  provider: providerId,
  account_label: z.string(),
  status: z.enum(["connected", "expired", "disconnected"]),
  version: z.number().int(),
  updated_at: z.string(),
});
export const avatarSchema = z.object({
  id: z.string().uuid(),
  connection_id: z.string().uuid(),
  provider: providerId,
  name: z.string(),
  voice_name: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  status: avatarStatus,
  is_default: z.boolean(),
  verified_previews:z.array(z.object({test_id:z.string().uuid(),engine:z.string(),aspect_ratio:z.string(),crop:z.object({x:z.number(),y:z.number(),width:z.number(),height:z.number()})})).optional(),
  capabilities: z.object({
    engines: z.array(z.string()),
    transparency: z.enum(["unknown", "supported", "unsupported"]),
  }),
});
export const catalogAvatarSchema = z.object({
  provider_avatar_id: opaqueId,
  name: z.string(),
  thumbnail_url: z.string().nullable(),
  default_voice_id: z.string().nullable(),
  status: avatarStatus,
  engines: z.array(z.string()),
  avatar_type:z.string().optional(),
});
export const voiceSchema = z.object({
  provider_voice_id: opaqueId,
  name: z.string(),
  language: z.string().nullable(),
});
export const librarySchema = z.object({
  connections: z.array(connectionSchema),
  avatars: z.array(avatarSchema),
});
export const catalogSchema = z.object({
  items: z.array(catalogAvatarSchema),
  next_token: z.string().nullable(),
});
export const voicesSchema = z.object({
  items: z.array(voiceSchema),
  next_token: z.string().nullable(),
});
const connection = { connection_id: z.string().uuid() };
const cursor = z.string().max(2048).nullable().optional();
const managementCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("library") }).strict(),
  z.object({action:z.literal('verify_avatar_test'),test_id:z.string().uuid(),visual_approved:z.literal(true)}).strict(),
  z.object({ action: z.literal("engine_capabilities"), avatar_id:z.string().uuid() }).strict(),
  z.object({ action: z.literal("balance"), avatar_id:z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal("connect"),
      provider: providerId,
      api_key: z
        .string()
        .trim()
        .min(10)
        .max(2048)
        .regex(/^[\x21-\x7E]+$/),
      expected_version: z.number().int().nonnegative().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("catalog"),
      ...connection,
      cursor,
      ownership: z.enum(["private", "public"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("voices"),
      ...connection,
      cursor,
      voice_type: z.enum(["private", "public"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("import"),
      ...connection,
      provider_avatar_id: opaqueId,
      provider_voice_id: opaqueId.nullable(),
      name: z.string().trim().min(1).max(100),
    })
    .strict(),
  z
    .object({ action: z.literal("default"), avatar_id: z.string().uuid() })
    .strict(),
  z
    .object({
      action: z.literal("disconnect"),
      ...connection,
      expected_version: z.number().int().positive(),
    })
    .strict(),
]);
export type AvatarCommand = z.infer<typeof avatarCommandSchema>;
export const avatarCommandSchema=z.union([managementCommandSchema,testCommand]);
export type ProviderConnection = z.infer<typeof connectionSchema>;
export type Avatar = z.infer<typeof avatarSchema>;
export type CatalogAvatar = z.infer<typeof catalogAvatarSchema>;
export type ProviderVoice = z.infer<typeof voiceSchema>;
export type AvatarLibrary = z.infer<typeof librarySchema>;
export type AvatarCatalog = z.infer<typeof catalogSchema>;
export type VoiceCatalog = z.infer<typeof voicesSchema>;

export class PublicError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function usableAvatar(
  avatar: Avatar,
  connections: ProviderConnection[],
) {
  return (
    avatar.status === "ready" &&
    connections.some(
      (c) => c.id === avatar.connection_id && c.status === "connected",
    )
  );
}
