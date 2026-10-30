import type { SupabaseClient } from "@supabase/supabase-js";
import { credentialVault } from "./credential-crypto.ts";
import { PublicError } from "./avatar-contract.ts";
import { CreativeProvider } from "./creative-provider.ts";
import {
  agentPrompt,
  creativeFailure,
  type CreativeCommand,
  type CreativeJob,
} from "./creative-contract.ts";
import { HeyGenCatalog } from "./heygen.ts";
const enc = encodeURIComponent;
export function createCreativeService(
  db: SupabaseClient,
  vault: ReturnType<typeof credentialVault>,
  enabledForAll = false,
  providerFactory = (key: string) => new CreativeProvider(key),
) {
  const storage = () =>
    new PublicError(
      "STORAGE",
      "Could not save this operation. Refresh before trying again.",
      503,
    );
  async function owned(user: string, id: string) {
    const { data, error } = await db
      .from("creator_creative_jobs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user)
      .single();
    if (error || !data)
      throw new PublicError(
        "NOT_FOUND",
        "This job is not available in your account.",
        404,
      );
    return data as CreativeJob & {
      user_id: string;
      input: Record<string, any>;
    };
  }
  async function update(
    user: string,
    id: string,
    patch: Record<string, unknown>,
  ) {
    const { data, error } = await db
      .from("creator_creative_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user)
      .select("*")
      .single();
    if (error) throw storage();
    return data as CreativeJob;
  }
  async function connection(user: string, id: string) {
    const { data, error } = await db.rpc("creator_read_credential", {
      p_user_id: user,
      p_connection_id: id,
    });
    if (error || !data?.[0])
      throw new PublicError(
        "CONNECTION",
        "Connect HeyGen in Avatar Library first.",
        403,
      );
    const key = await vault.open(data[0], {
      userId: user,
      connectionId: id,
      provider: "heygen",
    });
    return {
      provider: providerFactory(key),
      catalog: new HeyGenCatalog(key),
      version: data[0].version,
    };
  }
  async function avatar(user: string, id: string, connectionId: string) {
    const { data, error } = await db
      .from("avatar_profiles")
      .select("*")
      .eq("id", id)
      .eq("user_id", user)
      .eq("connection_id", connectionId)
      .single();
    if (error || !data)
      throw new PublicError(
        "AVATAR",
        "Choose an avatar from this HeyGen connection.",
        404,
      );
    return data;
  }
  async function insert(
    user: string,
    id: string,
    connectionId: string,
    kind: CreativeJob["kind"],
    title: string,
    input: Record<string, unknown>,
  ) {
    const { data, error } = await db
      .from("creator_creative_jobs")
      .insert({
        id,
        user_id: user,
        connection_id: connectionId,
        kind,
        title,
        input,
        status: "submitting",
      })
      .select("*")
      .single();
    if (!error) return { job: data as CreativeJob, fresh: true };
    if (error.code !== "23505") throw storage();
    const conflict =
      kind === "look" || kind === "message"
        ? await db
            .from("creator_creative_jobs")
            .select("id")
            .eq("user_id", user)
            .eq("kind", kind)
            .contains(
              "input",
              kind === "look"
                ? { image_job_id: input.image_job_id }
                : { job_id: input.job_id, turn: input.turn },
            )
            .maybeSingle()
        : null;
    const previous = await owned(user, conflict?.data?.id ?? id);
    if (
      previous.kind !== kind ||
      previous.connection_id !== connectionId ||
      JSON.stringify(previous.input) !== JSON.stringify(input)
    ) {
      // JSONB key order is not stable: compare canonical objects.
      if (
        previous.kind !== kind ||
        previous.connection_id !== connectionId ||
        canonical(previous.input) !== canonical(input)
      )
        throw new PublicError(
          "CONFLICT",
          "This request ID belongs to different settings. Start a new request.",
          409,
        );
    }
    return { job: previous, fresh: false };
  }
  async function submit(
    user: string,
    id: string,
    connectionId: string,
    kind: CreativeJob["kind"],
    title: string,
    input: Record<string, unknown>,
    fn: () => Promise<{
      provider_id: string;
      status: string;
      result?: unknown;
    }>,
  ) {
    const record = await insert(user, id, connectionId, kind, title, input);
    if (!record.fresh) return record.job;
    try {
      return await update(user, id, { ...(await fn()), error: null });
    } catch (e) {
      const uncertain =
        !(e instanceof PublicError) ||
        e.code === "OUTCOME_UNKNOWN" ||
        e.status === 409;
      await update(user, id, {
        status: uncertain ? "submission_unknown" : "failed",
        error:
          e instanceof PublicError
            ? e.message
            : "The provider outcome could not be saved. Check HeyGen before resubmitting.",
      });
      throw e;
    }
  }
  async function refresh(user: string, id: string): Promise<CreativeJob> {
    const job = await owned(user, id);
    const { provider, catalog, version } = await connection(
      user,
      job.connection_id,
    );
    if (!job.provider_id) {
      if (
        job.status === "submitting" &&
        Date.now() - Date.parse(job.updated_at) > 90000
      )
        return update(user, id, {
          status: "submission_unknown",
          error:
            "The submission outcome is uncertain. Refresh to recover an image/import; check HeyGen before starting another video or look.",
        });
      // Only image and kit endpoints document idempotent submission recovery; never blindly replay a video or avatar creation.
      if (
        ["image", "kit"].includes(job.kind) &&
        job.status === "submission_unknown" &&
        Date.now() - Date.parse(job.created_at) < 23 * 3600_000
      ) {
        const data = await provider.data(
          job.kind === "image" ? "/v3/models/images" : "/v3/brand-kits",
          "POST",
          job.input.payload,
          job.id,
        );
        return update(user, id, {
          provider_id: data.generation_id ?? data.brand_kit_id,
          status: data.status ?? "pending",
          error: null,
        });
      }
      return job;
    }
    if (job.kind === "image") {
      const data = await provider.data(
        `/v3/models/images/${enc(job.provider_id)}`,
      );
      return update(user, id, {
        status: data.status,
        result: data,
        error: ["failed", "cancelled"].includes(data.status)
          ? creativeFailure(data.failure_code)
          : null,
      });
    }
    if (job.kind === "kit") {
      const data = await provider.data(
        `/v3/brand-kits/${enc(job.provider_id)}`,
      );
      return update(user, id, {
        status: data.status,
        result: data,
        error:
          data.status === "error"
            ? "The website import was incomplete. Review the assets in HeyGen or import another public page."
            : null,
      });
    }
    if (job.kind === "look") {
      const look = await catalog.getAvatar(job.provider_id);
      if (look.status === "ready" && job.status !== "completed") {
        const source = await avatar(
          user,
          job.input.avatar_id,
          job.connection_id,
        );
        const { error } = await db.rpc("creator_import_avatar", {
          p_user_id: user,
          p_connection_id: job.connection_id,
          p_expected_version: version,
          p_avatar: {
            name: job.title,
            provider_avatar_id: look.provider_avatar_id,
            provider_voice_id: source.provider_voice_id,
            voice_name: source.voice_name,
            thumbnail_url: look.thumbnail_url,
            capabilities: { engines: look.engines, transparency: "unknown" },
          },
        });
        if (error) throw storage();
      }
      return update(user, id, {
        status:
          look.status === "ready"
            ? "completed"
            : look.status === "error"
              ? "failed"
              : "processing",
        result: look,
        error:
          look.status === "error" ? creativeFailure("training_failed") : null,
      });
    }
    if (job.kind === "agent") {
      const data = await provider.data(
        `/v3/video-agents/${enc(job.provider_id)}`,
      );
      const resourceIds = [
        ...new Set<string>(
          (data.messages ?? []).flatMap((m: any) => m.resource_ids ?? []),
        ),
      ].slice(0, 20);
      const resources = (
        await Promise.all(
          resourceIds.map((resourceId) =>
            provider
              .data(
                `/v3/video-agents/${enc(job.provider_id!)}/resources/${enc(resourceId)}`,
              )
              .catch(() => null),
          ),
        )
      ).filter(Boolean);
      let video = null;
      if (data.video_id)
        video = await provider.data(`/v3/videos/${enc(data.video_id)}`);
      const status =
        video?.status === "completed"
          ? "completed"
          : video?.status === "failed"
            ? "failed"
            : data.status === "completed"
              ? "generating"
              : data.status;
      return update(user, id, {
        status,
        result: { ...data, resources, video },
        error:
          status === "failed" ? creativeFailure(video?.failure_code) : null,
      });
    }
    return job;
  }
  return {
    async execute(user: string, command: CreativeCommand) {
      const access = await db
        .from("creator_creative_access")
        .select("enabled")
        .eq("user_id", user)
        .maybeSingle();
      const enabled = enabledForAll || access.data?.enabled === true;
      if (command.action === "state") {
        if (!enabled) return { enabled: false, jobs: [], brand: null };
        const [jobs, brand] = await Promise.all([
          db
            .from("creator_creative_jobs")
            .select(
              "id,connection_id,kind,status,provider_id,title,result,error,created_at,updated_at",
            )
            .eq("user_id", user)
            .neq("kind", "message")
            .order("created_at", { ascending: false })
            .limit(100),
          db
            .from("creator_creative_brand")
            .select("connection_id,kit_id")
            .eq("user_id", user)
            .maybeSingle(),
        ]);
        if (jobs.error || brand.error) throw storage();
        return { enabled: true, jobs: jobs.data, brand: brand.data };
      }
      if (!enabled)
        throw new PublicError(
          "FEATURE_DISABLED",
          "These creative tools are not enabled for this account yet.",
          403,
        );
      const limit = await db.rpc("creator_avatar_rate_limit", {
        p_user_id: user,
        p_operation: "other",
      });
      if (limit.error || !limit.data)
        throw new PublicError(
          "RATE_LIMIT",
          "Too many requests. Wait a minute and try again.",
          429,
        );
      if (command.action === "refresh") return refresh(user, command.job_id);
      if (command.action === "agent_message") {
        const job = await owned(user, command.job_id);
        if (job.kind !== "agent" || !job.provider_id)
          throw new PublicError(
            "SESSION",
            "This video session is not ready.",
            409,
          );
        const { provider } = await connection(user, job.connection_id);
        const fresh = await provider.data(
          `/v3/video-agents/${enc(job.provider_id)}`,
        );
        if (!["reviewing", "waiting_for_input"].includes(fresh.status))
          throw new PublicError(
            "SESSION_BUSY",
            "Wait for storyboard review before sending another instruction.",
            409,
          );
        const message = command.generate
          ? "The creator approves the storyboard. Generate the full video now."
          : `Revise the storyboard only and return for review before rendering. Requested changes: ${command.message}`;
        const turnBytes = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(canonical(fresh.messages ?? [])),
        );
        const turn = Array.from(new Uint8Array(turnBytes), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        let result: CreativeJob;
        try {
          result = await submit(
            user,
            command.request_id,
            job.connection_id,
            "message",
            "Storyboard instruction",
            { job_id: job.id, turn, message },
            async () => {
              const sent = await provider.data(
                `/v3/video-agents/${enc(job.provider_id!)}`,
                "POST",
                { message },
              );
              return {
                provider_id: sent.run_id ?? job.provider_id!,
                status: "completed",
                result: sent,
              };
            },
          );
        } catch (e) {
          await update(user, job.id, {
            status:
              e instanceof PublicError &&
              e.code !== "OUTCOME_UNKNOWN" &&
              e.status !== 409
                ? "reviewing"
                : "submission_unknown",
            error:
              "The instruction could not be confirmed. Check this session in HeyGen before sending another approval.",
          });
          throw e;
        }
        if (result.status === "completed")
          await update(user, job.id, {
            status: command.generate ? "generating" : "thinking",
            error: null,
          });
        return refresh(user, job.id);
      }
      if (command.action === "save_look") {
        const image = await owned(user, command.image_job_id);
        if (image.kind !== "image")
          throw new PublicError("IMAGE", "Choose a generated image.", 400);
        const latest = await refresh(user, image.id);
        const output = latest.result.images?.[0];
        if (latest.status !== "completed" || !output?.image_url)
          throw new PublicError(
            "IMAGE",
            "Wait for the image before saving a look.",
            409,
          );
        const { provider } = await connection(user, image.connection_id);
        const source = await avatar(
          user,
          image.input.avatar_id,
          image.connection_id,
        );
        const original = await provider.data(
          `/v3/avatars/looks/${enc(source.provider_avatar_id)}`,
        );
        const payload = {
          type: "photo",
          name: command.name,
          file: { type: "url", url: output.image_url },
          ...(original.avatar_group_id
            ? { avatar_group_id: original.avatar_group_id }
            : {}),
        };
        return submit(
          user,
          command.request_id,
          image.connection_id,
          "look",
          command.name,
          { avatar_id: image.input.avatar_id, image_job_id: image.id },
          async () => {
            const data = await provider.data(
              "/v3/avatars",
              "POST",
              payload,
              command.request_id,
            );
            return { provider_id: data.avatar_item.id, status: "processing" };
          },
        );
      }
      const { provider, catalog } = await connection(
        user,
        command.connection_id,
      );
      if (command.action === "upload") {
        let bytes: Uint8Array;
        try {
          bytes = Uint8Array.from(atob(command.base64), (c) => c.charCodeAt(0));
        } catch {
          throw new PublicError("IMAGE", "This image could not be read.", 400);
        }
        const png =
            bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71,
          jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (
          bytes.length > 5 * 1024 * 1024 ||
          !(command.mime === "image/png" ? png : jpeg)
        )
          throw new PublicError(
            "IMAGE",
            "Upload a PNG or JPEG under 5 MB.",
            400,
          );
        const form = new FormData();
        form.append(
          "file",
          new Blob([new Uint8Array(bytes).buffer], { type: command.mime }),
          command.name,
        );
        const data = await provider.data("/v3/assets", "POST", form);
        const id = crypto.randomUUID();
        const saved = await db.from("creator_creative_assets").insert({
          id,
          user_id: user,
          connection_id: command.connection_id,
          provider_id: data.asset_id,
          name: command.name,
        });
        if (saved.error) throw storage();
        return { id, name: command.name };
      }
      if (command.action === "kits")
        return provider.request(
          `/v3/brand-kits?limit=50${command.cursor ? `&token=${enc(command.cursor)}` : ""}`,
        );
      if (command.action === "kit")
        return provider.data(`/v3/brand-kits/${enc(command.kit_id)}`);
      if (command.action === "import_kit") {
        const payload = { url: command.url, name: command.name };
        return submit(
          user,
          command.request_id,
          command.connection_id,
          "kit",
          command.name,
          { payload },
          async () => {
            const data = await provider.data(
              "/v3/brand-kits",
              "POST",
              payload,
              command.request_id,
            );
            return {
              provider_id: data.brand_kit_id,
              status: data.status ?? "loading",
              result: data,
            };
          },
        );
      }
      if (command.action === "update_kit") {
        const kit = await provider.data(
          `/v3/brand-kits/${enc(command.kit_id)}`,
        );
        if (kit.status !== "completed")
          throw new PublicError(
            "KIT",
            "Wait for the kit to finish importing.",
            409,
          );
        for (const font of Object.values(command.roles.font_roles ?? {}))
          if (font && !kit.fonts?.some((f: any) => f.font_id === font.font_id))
            throw new PublicError(
              "FONT",
              "Choose a font that exists in this kit.",
              400,
            );
        const logo = command.roles.logo_roles?.primary;
        if (logo && !kit.logos?.some((l: any) => l.logo_id === logo))
          throw new PublicError(
            "LOGO",
            "Choose a logo that exists in this kit.",
            400,
          );
        await provider.data(
          `/v3/brand-kits/${enc(command.kit_id)}`,
          "PATCH",
          command.roles,
        );
        return provider.data(`/v3/brand-kits/${enc(command.kit_id)}`);
      }
      if (command.action === "default_kit") {
        const kit = await provider.data(
          `/v3/brand-kits/${enc(command.kit_id)}`,
        );
        if (kit.status !== "completed")
          throw new PublicError("KIT", "Select a completed brand kit.", 409);
        const saved = await db.from("creator_creative_brand").upsert({
          user_id: user,
          connection_id: command.connection_id,
          kit_id: command.kit_id,
          updated_at: new Date().toISOString(),
        });
        if (saved.error) throw storage();
        return kit;
      }
      if (command.action === "image") {
        await avatar(user, command.avatar_id, command.connection_id);
        const ids = [...new Set([...command.identities, command.reference])];
        const assets = await db
          .from("creator_creative_assets")
          .select("id,provider_id")
          .eq("user_id", user)
          .eq("connection_id", command.connection_id)
          .in("id", ids);
        if (assets.error || assets.data?.length !== ids.length)
          throw new PublicError(
            "ASSET",
            "Upload your identity and reference photos to this connection first.",
            400,
          );
        const asset = (id: string) => ({
          type: "asset_id",
          asset_id: assets.data!.find((a) => a.id === id)!.provider_id,
        });
        const payload = {
          model: "heygen-image-1",
          identity_images: command.identities.map(asset),
          reference_images: [asset(command.reference)],
          num_images: 1,
          aspect_ratio: command.orientation === "portrait" ? "9:16" : "16:9",
        };
        return submit(
          user,
          command.request_id,
          command.connection_id,
          "image",
          command.name,
          { avatar_id: command.avatar_id, rights: true, payload },
          async () => {
            const data = await provider.data(
              "/v3/models/images",
              "POST",
              payload,
              command.request_id,
            );
            return {
              provider_id: data.generation_id,
              status: data.status ?? "pending",
              result: data,
            };
          },
        );
      }
      if (command.action === "agent") {
        const selected = await avatar(
          user,
          command.avatar_id,
          command.connection_id,
        );
        const look = await catalog.getAvatar(selected.provider_avatar_id);
        if (
          look.status !== "ready" ||
          !look.engines.length ||
          !selected.provider_voice_id
        )
          throw new PublicError(
            "AVATAR",
            "Choose a ready avatar with supported API engines and a saved voice.",
            400,
          );
        const profile = await db
          .from("content_profiles")
          .select("name,primary_audience,strategy")
          .eq("id", command.profile_id)
          .eq("user_id", user)
          .single();
        if (profile.error || !profile.data)
          throw new PublicError(
            "PROFILE",
            "Choose a Content Profile from your account.",
            404,
          );
        if (command.kit_id) {
          const kit = await provider.data(
            `/v3/brand-kits/${enc(command.kit_id)}`,
          );
          if (kit.status !== "completed")
            throw new PublicError(
              "KIT",
              "Wait for the selected brand kit to finish importing.",
              409,
            );
        }
        let prompt: string;
        try {
          prompt = agentPrompt(command, profile.data);
        } catch (e) {
          throw new PublicError("LENGTH", (e as Error).message, 400);
        }
        const payload = {
          prompt,
          mode: "chat",
          avatar_id: selected.provider_avatar_id,
          voice_id: selected.provider_voice_id,
          orientation: command.orientation,
          ...(command.kit_id ? { brand_kit_id: command.kit_id } : {}),
        };
        return submit(
          user,
          command.request_id,
          command.connection_id,
          "agent",
          command.title,
          {
            profile_id: command.profile_id,
            avatar_id: command.avatar_id,
            source: command.source,
            angle: command.angle,
            script: command.script,
            payload,
          },
          async () => {
            const data = await provider.data(
              "/v3/video-agents",
              "POST",
              payload,
            );
            return {
              provider_id: data.session_id,
              status: data.status ?? "thinking",
              result: data,
            };
          },
        );
      }
      throw new PublicError("COMMAND", "Unsupported action.", 400);
    },
  };
}
function canonical(value: any): string {
  if (Array.isArray(value))
    return JSON.stringify(value.map((v) => JSON.parse(canonical(v))));
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((k) => [k, JSON.parse(canonical(value[k]))]),
      ),
    );
  return JSON.stringify(value);
}
