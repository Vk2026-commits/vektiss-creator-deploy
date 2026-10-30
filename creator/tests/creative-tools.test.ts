import { describe, it, expect, vi } from "vitest";
import {
  creativeCommandSchema,
  agentPrompt,
  creativeFailure,
} from "../supabase/functions/_shared/creative-contract";
import { CreativeProvider } from "../supabase/functions/_shared/creative-provider";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const id = "00000000-0000-4000-8000-000000000001";
describe("creative requests", () => {
  const image = {
    action: "image",
    request_id: id,
    connection_id: id,
    avatar_id: id,
    identities: [id],
    reference: id,
    orientation: "portrait",
    rights: true,
    paid_consent: true,
    name: "Office",
  };
  it("requires permission, explicit paid consent and one to five identity photos", () => {
    expect(creativeCommandSchema.safeParse(image).success).toBe(true);
    for (const patch of [
      { rights: false },
      { paid_consent: false },
      { identities: [] },
      { identities: Array(6).fill(id) },
      { orientation: "square" },
    ])
      expect(
        creativeCommandSchema.safeParse({ ...image, ...patch }).success,
      ).toBe(false);
    expect(
      creativeCommandSchema.safeParse({ ...image, orientation: "landscape" })
        .success,
    ).toBe(true);
  });
  it("limits brand role edits to supported fields", () => {
    const request = {
      action: "update_kit",
      connection_id: id,
      kit_id: "kit",
      roles: { color_roles: { primary: "#1688FF" } },
    };
    expect(creativeCommandSchema.safeParse(request).success).toBe(true);
    expect(
      creativeCommandSchema.safeParse({
        ...request,
        roles: { logo_url: "https://example.com/x" },
      }).success,
    ).toBe(false);
  });
  it("carries approved source and narration and rejects oversized prompts", () => {
    const input = {
      title: "Title",
      source: "Source",
      angle: "Angle",
      script: "Exact script",
    };
    expect(agentPrompt(input, { name: "Profile" })).toContain("Exact script");
    expect(agentPrompt(input, {})).toContain("Pause for storyboard approval");
    expect(() =>
      agentPrompt({ ...input, script: "x".repeat(10001) }, {}),
    ).toThrow("10,000");
    expect(creativeFailure("no_face_detected")).toContain("clear face");
  });
  it("retains an idempotency key and does not expose provider error bodies", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { generation_id: "a" } })),
      );
    await new CreativeProvider("secret", transport).data(
      "/v3/models/images",
      "POST",
      { num_images: 1 },
      id,
    );
    expect(transport.mock.calls[0][1].headers["Idempotency-Key"]).toBe(id);
    for (const status of [401, 402, 403, 429, 500]) {
      const api = new CreativeProvider(
        "secret",
        vi
          .fn()
          .mockResolvedValue(
            new Response("secret provider details", { status }),
          ),
      );
      await expect(api.data("/v3/models/images")).rejects.not.toThrow("secret");
    }
  });
});
it("keeps creative state server-owned and saves a generated look only once", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table provider_connections(id uuid primary key);grant usage on schema public to anon,authenticated,service_role;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610300001_creative_tools.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into provider_connections values($1)", [id]);
    await db.query(
      `insert into creator_creative_jobs(id,user_id,connection_id,kind,title,input) values($1,$1,$1,'look','Office',$2)`,
      [id, JSON.stringify({ image_job_id: id })],
    );
    await expect(
      db.query(
        `insert into creator_creative_jobs(id,user_id,connection_id,kind,title,input) values('00000000-0000-4000-8000-000000000002',$1,$1,'look','Duplicate',$2)`,
        [id, JSON.stringify({ image_job_id: id })],
      ),
    ).rejects.toThrow();
    await db.exec("set role authenticated");
    for (const table of [
      "creator_creative_jobs",
      "creator_creative_assets",
      "creator_creative_brand",
      "creator_creative_access",
    ]) {
      await expect(db.query(`select * from ${table}`)).rejects.toThrow(
        "permission denied",
      );
      await expect(
        db.query(`insert into ${table} default values`),
      ).rejects.toThrow("permission denied");
    }
  } finally {
    await db.close();
  }
}, 30000);
