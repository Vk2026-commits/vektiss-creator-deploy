import {
  contentInputSchema,
  creatorInputSchema,
  emptyCreator,
  emptyContent,
  type Workspace,
  type Creator,
  type ContentProfile,
} from "../domain/strategy";
import type { StrategyRepository } from "./repository";

const key = "vektiss-creator:local-preview:v1";
const userId = "local-preview";
export function createPreviewRepository(): StrategyRepository {
  function initial(): Workspace {
    const creator: Creator = {
      ...structuredClone(emptyCreator),
      id: crypto.randomUUID(),
      user_id: userId,
      display_name: "Alex Morgan",
      bio: "Security-company owner and educator.",
      context: {
        ...emptyCreator.context,
        expertise: "Private security, situational awareness and prevention.",
        experience:
          "15 years leading security teams and training business owners.",
        tone: ["Calm", "Experienced", "Educational"],
      },
      default_content_profile_id: null,
      updated_at: new Date().toISOString(),
    };
    const profiles: ContentProfile[] = [
      {
        name: "Women & Public Safety",
        primary_audience:
          "Women who want to feel informed and confident about their everyday safety.",
        strategy: {
          ...emptyContent.strategy,
          content_pillars: [
            "Situational awareness",
            "Everyday safety",
            "Prevention",
          ],
          audience_problems: [
            "Recognizing warning signs without living in fear",
          ],
          audience_interests: ["Practical habits", "Protecting family"],
          desired_outcomes: ["Build confidence", "Teach a useful safety habit"],
          tone: ["Calm", "Protective", "Respectful"],
          things_to_avoid: [
            "Victim blaming",
            "Fearmongering",
            "Unsupported claims",
          ],
        },
      },
      {
        name: "Security Business Owners",
        primary_audience:
          "Owners building a trusted, sustainable security company.",
        strategy: {
          ...emptyContent.strategy,
          content_pillars: ["Leadership", "Operations", "Client relationships"],
          desired_outcomes: ["Improve operations", "Build trust"],
          tone: ["Direct", "Practical"],
        },
      },
    ].map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      creator_profile_id: creator.id,
      user_id: userId,
      archived_at: null,
      updated_at: new Date().toISOString(),
    }));
    creator.default_content_profile_id = profiles[0].id;
    return { creator, profiles };
  }
  function read(): Workspace {
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved) as Workspace;
      if (data.creator)
        creatorInputSchema.parse({
          display_name: data.creator.display_name,
          bio: data.creator.bio,
          context: data.creator.context,
        });
      data.profiles.forEach((p) =>
        contentInputSchema.parse({
          name: p.name,
          primary_audience: p.primary_audience,
          strategy: p.strategy,
        }),
      );
      return data;
    }
    const data = initial();
    write(data);
    return data;
  }
  function write(data: Workspace) {
    localStorage.setItem(key, JSON.stringify(data));
  }
  return {
    async load() {
      return read();
    },
    async saveCreator(input, existing) {
      const data = read();
      if (existing && data.creator?.updated_at !== existing.updated_at)
        throw new Error("STALE");
      data.creator = {
        ...creatorInputSchema.parse(input),
        id: existing?.id ?? crypto.randomUUID(),
        user_id: userId,
        default_content_profile_id:
          data.creator?.default_content_profile_id ?? null,
        updated_at: new Date().toISOString(),
      };
      write(data);
      return data.creator;
    },
    async saveContent(input, creatorId, existing) {
      const data = read();
      const parsed = contentInputSchema.parse(input);
      if (
        data.profiles.some(
          (p) =>
            p.name.toLowerCase() === parsed.name.toLowerCase() &&
            p.id !== existing?.id,
        )
      )
        throw { code: "23505" };
      if (
        existing &&
        data.profiles.find((p) => p.id === existing.id)?.updated_at !==
          existing.updated_at
      )
        throw new Error("STALE");
      const profile = {
        ...parsed,
        id: existing?.id ?? crypto.randomUUID(),
        user_id: userId,
        creator_profile_id: creatorId,
        archived_at: existing?.archived_at ?? null,
        updated_at: new Date().toISOString(),
      };
      data.profiles = [
        ...data.profiles.filter((p) => p.id !== profile.id),
        profile,
      ];
      write(data);
      return profile;
    },
    async setDefault(id, creator) {
      const data = read();
      if (!data.creator || data.creator.updated_at !== creator.updated_at)
        throw new Error("STALE");
      if (id && !data.profiles.some((p) => p.id === id && !p.archived_at))
        throw new Error("Invalid profile");
      data.creator.default_content_profile_id = id;
      data.creator.updated_at = new Date().toISOString();
      write(data);
    },
    async archive(profile, archived) {
      const data = read();
      const target = data.profiles.find((p) => p.id === profile.id);
      if (!target || target.updated_at !== profile.updated_at)
        throw new Error("STALE");
      target.archived_at = archived ? new Date().toISOString() : null;
      target.updated_at = new Date().toISOString();
      if (archived && data.creator?.default_content_profile_id === profile.id) {
        data.creator.default_content_profile_id = null;
        data.creator.updated_at = new Date().toISOString();
      }
      write(data);
    },
  };
}
