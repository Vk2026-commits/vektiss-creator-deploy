import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contentInputSchema,
  creatorInputSchema,
  type ContentInput,
  type ContentProfile,
  type Creator,
  type CreatorInput,
  type Workspace,
} from "../domain/strategy";

export interface StrategyRepository {
  load(): Promise<Workspace>;
  saveCreator(input: CreatorInput, existing: Creator | null): Promise<Creator>;
  saveContent(
    input: ContentInput,
    creatorId: string,
    existing?: ContentProfile,
  ): Promise<ContentProfile>;
  setDefault(id: string | null, creator: Creator): Promise<void>;
  archive(profile: ContentProfile, archived: boolean): Promise<void>;
}

export function createSupabaseRepository(
  client: SupabaseClient,
  userId: string,
): StrategyRepository {
  return {
    async load() {
      const [creator, profiles] = await Promise.all([
        client
          .from("creator_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        client
          .from("content_profiles")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
      ]);
      if (creator.error) throw creator.error;
      if (profiles.error) throw profiles.error;
      return {
        creator: creator.data as Creator | null,
        profiles: (profiles.data ?? []) as ContentProfile[],
      };
    },
    async saveCreator(input, existing) {
      const data = creatorInputSchema.parse(input);
      const query = existing
        ? client
            .from("creator_profiles")
            .update(data)
            .eq("id", existing.id)
            .eq("updated_at", existing.updated_at)
        : client.from("creator_profiles").insert({ ...data, user_id: userId });
      const result = await query.select("*").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("STALE");
      return result.data as Creator;
    },
    async saveContent(input, creatorId, existing) {
      const data = contentInputSchema.parse(input);
      data.strategy = {research_screening_criteria:'',research_source_platforms:[],research_reference_urls:[],...existing?.strategy,...data.strategy};
      const query = existing
        ? client
            .from("content_profiles")
            .update(data)
            .eq("id", existing.id)
            .eq("updated_at", existing.updated_at)
        : client
            .from("content_profiles")
            .insert({
              ...data,
              creator_profile_id: creatorId,
              user_id: userId,
            });
      const result = await query.select("*").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("STALE");
      return result.data as ContentProfile;
    },
    async setDefault(id, creator) {
      const { error } = await client.rpc("set_default_content_profile", {
        profile_id: id,
        expected_updated_at: creator.updated_at,
      });
      if (error) throw error;
    },
    async archive(profile, archived) {
      const { error } = await client.rpc("archive_content_profile", {
        profile_id: profile.id,
        should_archive: archived,
        expected_updated_at: profile.updated_at,
      });
      if (error) throw error;
    },
  };
}
