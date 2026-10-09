import type { SupabaseClient } from "@supabase/supabase-js";
import {
  librarySchema,
  PublicError,
  type AvatarCommand,
  type AvatarLibrary,
} from "./avatar-contract.ts";
import { credentialVault, type SealedCredential } from "./credential-crypto.ts";
import { HeyGenCatalog, type AvatarCatalogProvider } from "./heygen.ts";
import { presenterTestService } from './presenter-test-service.ts';
import {verifySavedAvatar} from './avatar-verification.ts';

export interface AvatarService {
  execute(userId: string, command: AvatarCommand, authorization?:string): Promise<unknown>;
}
export function createAvatarService(
  db: SupabaseClient,
  vault: ReturnType<typeof credentialVault>,
  providerFactory: (key: string) => AvatarCatalogProvider = (key) =>
    new HeyGenCatalog(key),
  verificationOrigin?:string,
): AvatarService {
  async function rpc(name: string, params: Record<string, unknown>) {
    const { data, error } = await db.rpc(name, params);
    if (error) {
      if (error.code === "40001" || error.code === "23505")
        throw new PublicError(
          "STALE",
          "This connection changed. Refresh your library and try again.",
          409,
        );
      if (error.code === "42501")
        throw new PublicError(
          "NOT_AVAILABLE",
          "That presenter is not available in your account.",
          403,
        );
      throw new PublicError(
        "STORAGE",
        "Your connection could not be saved. Please try again.",
        503,
      );
    }
    return data;
  }
  async function library(userId: string): Promise<AvatarLibrary> {
    const [connections, avatars] = await Promise.all([
      db
        .from("provider_connections")
        .select("id,provider,account_label,status,version,updated_at")
        .eq("user_id", userId),
      db
        .from("avatar_profiles")
        .select(
          "id,connection_id,provider,name,voice_name,thumbnail_url,status,is_default,capabilities",
        )
        .eq("user_id", userId)
        .order("created_at"),
    ]);
    if (connections.error || avatars.error)
      throw new PublicError(
        "STORAGE",
        "Your avatar library could not load. Try again.",
        503,
      );
    const verified=await db.from('creator_avatar_verifications').select('avatar_id,connection_id,thumbnail_url,test_id,engine,aspect_ratio,crop').eq('user_id',userId).eq('verification_version',1).not('visual_approved_at','is',null);
    if(verified.error)throw new PublicError('STORAGE','Could not load avatar checks. Please retry.',503);
    return librarySchema.parse({
      connections: connections.data,
      avatars: avatars.data.map(a=>({...a,verified_previews:(verified.data??[]).filter(v=>v.avatar_id===a.id&&v.connection_id===a.connection_id&&v.thumbnail_url===a.thumbnail_url)})),
    });
  }
  async function withProvider<T>(
    userId: string,
    connectionId: string,
    fn: (provider: AvatarCatalogProvider, version: number) => Promise<T>,
  ): Promise<T> {
    const rows = (await rpc("creator_read_credential", {
      p_user_id: userId,
      p_connection_id: connectionId,
    })) as Array<SealedCredential & { version: number }>;
    const secret = rows?.[0];
    if (!secret)
      throw new PublicError(
        "CONNECT_REQUIRED",
        "Connect HeyGen before choosing a presenter.",
        409,
      );
    const apiKey = await vault.open(secret, {
      userId,
      connectionId,
      provider: "heygen",
    });
    try {
      return await fn(providerFactory(apiKey), secret.version);
    } catch (error) {
      if (error instanceof PublicError && error.code === "PROVIDER_AUTH")
        await rpc("creator_expire_connection", {
          p_user_id: userId,
          p_connection_id: connectionId,
          p_expected_version: secret.version,
        });
      throw error;
    }
  }
  return {
    async execute(userId, command,authorization) {
      const allowed = await rpc("creator_avatar_rate_limit", {
        p_user_id: userId,
        p_operation: command.action === "connect" ? "connect" : "other",
      });
      if (!allowed)
        throw new PublicError(
          "RATE_LIMIT",
          "Too many requests. Please wait a minute and try again.",
          429,
        );
      if(command.action==='verify_avatar_test'){
        if(!verificationOrigin||!authorization)throw new PublicError('VERIFICATION','Background verification is not available yet. No paid render was started.',503);
        return verifySavedAvatar(db,userId,command.test_id,authorization,verificationOrigin,command.visual_approved);
      }
      if(command.action==='prepare_test'||command.action==='start_test'||command.action==='test_status'||command.action==='download_test')return presenterTestService(db,vault)(userId,command);
      if (command.action === "library") return library(userId);
      if(command.action==='engine_capabilities'){
        const {data:avatar,error}=await db.from('avatar_profiles').select('connection_id,provider_avatar_id').eq('id',command.avatar_id).eq('user_id',userId).single();
        if(error||!avatar)throw new PublicError('NOT_AVAILABLE','Avatar unavailable.',403);
        return withProvider(userId,avatar.connection_id,p=>p.getAvatar(avatar.provider_avatar_id));
      }
      if(command.action==='balance'){
        const {data:avatar,error}=await db.from('avatar_profiles').select('connection_id').eq('id',command.avatar_id).eq('user_id',userId).single();
        if(error||!avatar)throw new PublicError('NOT_AVAILABLE','That presenter is not available in your account.',403);
        return withProvider(userId,avatar.connection_id,p=>{if(!p.balance)throw new PublicError('UNAVAILABLE','Balance lookup is unavailable.',503);return p.balance();});
      }
      if (command.action === "connect") {
        const existing = (await library(userId)).connections.find(
          (c) => c.provider === command.provider,
        );
        if ((existing?.version ?? null) !== command.expected_version)
          throw new PublicError(
            "STALE",
            "Your connection changed. Refresh and try again.",
            409,
          );
        const connectionId = existing?.id ?? crypto.randomUUID();
        const sealed = await vault.seal(command.api_key, {
          userId,
          connectionId,
          provider: command.provider,
        });
        const account = await providerFactory(command.api_key).verify();
        await rpc("creator_store_connection", {
          p_user_id: userId,
          p_connection_id: connectionId,
          p_expected_version: command.expected_version,
          p_account_label: account.accountLabel,
          p_ciphertext: sealed.ciphertext,
          p_nonce: sealed.nonce,
          p_key_version: sealed.key_version,
        });
        return library(userId);
      }
      if (command.action === "default") {
        await rpc("creator_set_default_avatar", {
          p_user_id: userId,
          p_avatar_id: command.avatar_id,
        });
        return library(userId);
      }
      if (command.action === "disconnect") {
        await rpc("creator_disconnect_provider", {
          p_user_id: userId,
          p_connection_id: command.connection_id,
          p_expected_version: command.expected_version,
        });
        return library(userId);
      }
      if (command.action === "catalog")
        return withProvider(userId, command.connection_id, (p) =>
          p.listAvatars(command.cursor ?? null, command.ownership),
        );
      if (command.action === "voices")
        return withProvider(userId, command.connection_id, (p) =>
          p.listVoices(command.cursor ?? null, command.voice_type),
        );
      if (command.action === "import") {
        await withProvider(
          userId,
          command.connection_id,
          async (provider, version) => {
            const avatar = await provider.getAvatar(command.provider_avatar_id);
            if (avatar.status !== "ready")
              throw new PublicError(
                "AVATAR_NOT_READY",
                "This avatar is not ready yet. Choose another or try again later.",
                409,
              );
            const voiceId =
              command.provider_voice_id ?? avatar.default_voice_id;
            if (!voiceId)
              throw new PublicError(
                "VOICE_REQUIRED",
                "Choose a voice for this presenter.",
              );
            const voice = await provider.getVoice(voiceId);
            await rpc("creator_import_avatar", {
              p_user_id: userId,
              p_connection_id: command.connection_id,
              p_expected_version: version,
              p_avatar: {
                name: command.name,
                provider_avatar_id: avatar.provider_avatar_id,
                provider_voice_id: voice.provider_voice_id,
                voice_name: voice.name,
                thumbnail_url: avatar.thumbnail_url,
                capabilities: {
                  engines: avatar.engines,
                  transparency: "unknown",
                },
              },
            });
          },
        );
        return library(userId);
      }
      throw new PublicError("INVALID_INPUT", "Unknown avatar operation.");
    },
  };
}
