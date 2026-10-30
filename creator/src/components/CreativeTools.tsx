import { useCallback, useEffect, useRef, useState } from "react";
import {
  creativeRequest,
  uploadCreativeImage,
  type CreativeState,
} from "../lib/creative-client";
import { avatarRepository } from "../lib/avatar-repository";
import { notifyAvatarLibrary } from "../lib/avatar-library-events";
import { mediaFetch } from "../lib/media-fetch";
import { defaultEditBrand } from "../domain/edit-brand";
import type { ContentProfile } from "../domain/strategy";
import type { AvatarLibrary } from "../../supabase/functions/_shared/avatar-contract";
import type {
  BrandKit,
  CreativeJob,
} from "../../supabase/functions/_shared/creative-contract";
import { EditStudio } from "./EditStudio";
import "./creative-tools.css";
const presets = [
  ["modern-office", "Modern Office"],
  ["podcast-studio", "Podcast Studio"],
  ["home-office", "Home Office"],
  ["clean-studio", "Clean Studio"],
] as const;
const active = (job: CreativeJob) =>
  !["completed", "failed", "cancelled", "error", "submission_unknown"].includes(
    job.status,
  );
const safeUrl = (url: unknown) =>
  typeof url === "string" && url.startsWith("https://") ? url : undefined;
export function CreativeTools({
  tab,
  profiles,
  selectedId,
  onTab,
  seed,
}: {
  tab: "looks" | "brands" | "agent" | "videos";
  profiles: ContentProfile[];
  selectedId: string | null;
  seed?: {
    title?: string;
    profileId?: string;
    source?: string;
    angle?: string;
    script?: string;
    avatarId?: string;
  } | null;
  onTab: (tab: "looks" | "brands" | "agent" | "videos") => void;
}) {
  const [state, setState] = useState<CreativeState | null>(null),
    [library, setLibrary] = useState<AvatarLibrary>({
      connections: [],
      avatars: [],
    });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const pending = useRef(false);
  const [tick, setTick] = useState(Date.now());
  const [avatarId, setAvatarId] = useState(""),
    [orientation, setOrientation] = useState<"portrait" | "landscape">(
      "portrait",
    );
  const selectedAvatar = library.avatars.find((a) => a.id === avatarId);
  const connectionId =
    selectedAvatar?.connection_id ??
    library.connections.find((c) => c.status === "connected")?.id ??
    "";
  const [identities, setIdentities] = useState<File[]>([]),
    [reference, setReference] = useState<File | null>(null),
    [preset, setPreset] = useState("modern-office"),
    [rights, setRights] = useState(false),
    [lookName, setLookName] = useState("My new look");
  const [kits, setKits] = useState<BrandKit[]>([]),
    [kit, setKit] = useState<BrandKit | null>(null),
    [kitId, setKitId] = useState(""),
    [cursor, setCursor] = useState<string | null>(null);
  const [brandUrl, setBrandUrl] = useState(""),
    [brandName, setBrandName] = useState("My brand");
  const [colors, setColors] = useState<Record<string, string>>({}),
    [logo, setLogo] = useState(""),
    [titleFont, setTitleFont] = useState(""),
    [bodyFont, setBodyFont] = useState(""),
    [titleWeight, setTitleWeight] = useState(700),
    [bodyWeight, setBodyWeight] = useState(400);
  const [profileId, setProfileId] = useState(selectedId ?? ""),
    [title, setTitle] = useState(""),
    [source, setSource] = useState(""),
    [angle, setAngle] = useState(""),
    [script, setScript] = useState(""),
    [approved, setApproved] = useState(false);
  useEffect(() => {
    if (!seed) return;
    setTitle(seed.title ?? "");
    setProfileId(seed.profileId ?? selectedId ?? "");
    setSource(seed.source ?? "");
    setAngle(seed.angle ?? "");
    setScript(seed.script ?? "");
    if (seed.avatarId) setAvatarId(seed.avatarId);
    setApproved(false);
  }, [seed]);
  const [currentId, setCurrentId] = useState(""),
    [feedback, setFeedback] = useState(""),
    [editExport, setEditExport] = useState("");
  const imageAttempt = useRef<{ signature: string; command: any } | null>(null);
  const idRef = useRef<{ signature: string; id: string } | null>(null);
  function requestId(signature: string) {
    if (idRef.current?.signature !== signature)
      idRef.current = { signature, id: crypto.randomUUID() };
    return idRef.current.id;
  }
  const load = useCallback(async () => {
    const [next, avatars] = await Promise.all([
      creativeRequest<CreativeState>({ action: "state" }),
      avatarRepository.library(),
    ]);
    setState(next);
    setLibrary(avatars);
    setAvatarId(
      (id) =>
        id ||
        avatars.avatars.find((a) => a.is_default)?.id ||
        avatars.avatars[0]?.id ||
        "",
    );
    setKitId((id) => id || next.brand?.kit_id || "");
    return next;
  }, []);
  useEffect(() => {
    let live = true;
    void load().catch((e) => {
      if (live) setError(e.message);
    });
    return () => {
      live = false;
    };
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const polling = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => {
      if (polling.current || pending.current) return;
      const jobs =
        state?.jobs
          .filter(
            (j) =>
              active(j) &&
              !["reviewing", "waiting_for_input"].includes(j.status),
          )
          .slice(0, 3) ?? [];
      if (!jobs.length) return;
      polling.current = true;
      void Promise.all(
        jobs.map((j) =>
          creativeRequest<CreativeJob>({ action: "refresh", job_id: j.id }),
        ),
      )
        .then((next) =>
          setState((old) =>
            old
              ? {
                  ...old,
                  jobs: old.jobs.map(
                    (j) => next.find((n) => n.id === j.id) ?? j,
                  ),
                }
              : old,
          ),
        )
        .catch((e) => setError(e.message))
        .finally(() => {
          polling.current = false;
        });
    }, 6000);
    return () => clearInterval(timer);
  }, [state?.jobs]);
  async function run(fn: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
      try {
        await load();
      } catch {
        /* Keep original error. */
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function refreshJob(id: string) {
    await creativeRequest({ action: "refresh", job_id: id });
    await load();
  }
  async function loadKits(more = false) {
    if (!connectionId) return;
    const data = await creativeRequest({
      action: "kits",
      connection_id: connectionId,
      ...(more && cursor ? { cursor } : {}),
    });
    setKits((old) => (more ? [...old, ...data.data] : data.data));
    setCursor(data.has_more ? data.next_token : null);
  }
  function showKit(data: BrandKit) {
    setKit(data);
    setKitId(data.brand_kit_id);
    setColors(
      Object.fromEntries(
        Object.entries(data.color_roles ?? {}).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
    );
    setLogo(
      data.logos?.some((l) => l.logo_id === data.logo_roles?.primary)
        ? data.logo_roles!.primary!
        : "",
    );
    setTitleFont(
      data.fonts?.some(
        (f) => f.font_id === data.font_roles?.title_text?.font_id,
      )
        ? data.font_roles!.title_text!.font_id
        : "",
    );
    setBodyFont(
      data.fonts?.some((f) => f.font_id === data.font_roles?.body_text?.font_id)
        ? data.font_roles!.body_text!.font_id
        : "",
    );
    setTitleWeight(data.font_roles?.title_text?.weight ?? 700);
    setBodyWeight(data.font_roles?.body_text?.weight ?? 400);
  }
  useEffect(() => {
    if (!connectionId) return;
    void loadKits().catch((e) => setError(e.message));
  }, [connectionId]);
  async function generateLook() {
    if (!connectionId || !avatarId || !rights || !identities.length)
      throw Error("Choose an avatar, identity photos and confirm permission.");
    const signature = JSON.stringify([
      connectionId,
      avatarId,
      orientation,
      lookName,
      preset,
      reference?.name,
      reference?.lastModified,
      identities.map((f) => [f.name, f.size, f.lastModified]),
    ]);
    if (imageAttempt.current?.signature === signature) {
      await creativeRequest(imageAttempt.current.command);
      await load();
      return;
    }
    const ids = [];
    for (const file of identities)
      ids.push((await uploadCreativeImage(connectionId, file)).id);
    let ref = reference;
    if (!ref) {
      const response = await fetch(`/look-presets/${preset}.png`);
      if (!response.ok)
        throw Error("Preset could not load. Choose another preset.");
      ref = new File([await response.blob()], `${preset}.png`, {
        type: "image/png",
      });
    }
    const uploaded = await uploadCreativeImage(connectionId, ref);
    const command = {
      action: "image",
      request_id: crypto.randomUUID(),
      connection_id: connectionId,
      avatar_id: avatarId,
      identities: ids,
      reference: uploaded.id,
      orientation,
      rights: true,
      paid_consent: true,
      name: lookName,
    } as const;
    imageAttempt.current = { signature, command };
    const result = await creativeRequest<CreativeJob>(command);
    setCurrentId(result.id);
    await load();
  }
  async function startAgent() {
    const body = {
      connection_id: connectionId,
      profile_id: profileId,
      avatar_id: avatarId,
      ...(kitId ? { kit_id: kitId } : {}),
      orientation,
      title,
      source,
      angle,
      script,
    };
    const result = await creativeRequest<CreativeJob>({
      action: "agent",
      ...body,
      request_id: requestId(JSON.stringify(body)),
      paid_consent: true,
    });
    setCurrentId(result.id);
    await load();
  }
  const current =
    state?.jobs.find((j) => j.id === currentId) ??
    state?.jobs.find((j) => j.kind === (tab === "looks" ? "image" : "agent"));
  const controls = (
    <div className="creative-row">
      <label>
        Avatar
        <select value={avatarId} onChange={(e) => setAvatarId(e.target.value)}>
          {library.avatars.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.voice_name ?? "no voice selected"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Video shape
        <select
          value={orientation}
          onChange={(e) => setOrientation(e.target.value as typeof orientation)}
        >
          <option value="portrait">Portrait · 9:16</option>
          <option value="landscape">Wide · 16:9</option>
        </select>
      </label>
    </div>
  );
  if (editExport)
    return (
      <>
        <button className="button" onClick={() => setEditExport("")}>
          ← Back to AI videos
        </button>
        <EditStudio
          profileId={profileId || selectedId}
          initialExportId={editExport}
        />
      </>
    );
  return (
    <section className="creative-tools" aria-busy={busy}>
      <header>
        <span className="eyebrow">YOUR PRESENTER. YOUR BRAND.</span>
        <h1>
          {tab === "looks"
            ? "Create a new look"
            : tab === "brands"
              ? "Your brand kit"
              : tab === "videos"
                ? "AI-produced videos"
                : "Create an AI-produced video"}
        </h1>
        <p>
          Keep your identity and brand consistent, from the first idea to the
          finished video.
        </p>
      </header>
      <nav aria-label="Creative tools">
        {(["looks", "brands", "agent", "videos"] as const).map((t) => (
          <button
            key={t}
            className={t === tab ? "button primary" : "button"}
            onClick={() => onTab(t)}
          >
            {
              {
                looks: "Avatar looks",
                brands: "Brand Kit",
                agent: "AI-produced video",
                videos: "My AI videos",
              }[t]
            }
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!state ? (
        <p>Loading saved creative work…</p>
      ) : !state.enabled ? (
        <p>
          These tools are being rolled out. Your existing avatar and template
          workflows are still available.
        </p>
      ) : !connectionId ? (
        <p>Connect HeyGen in Avatar Library first.</p>
      ) : (
        <>
          {tab === "looks" && (
            <>
              <fieldset disabled={busy}>
                {controls}
                <label>
                  Look name
                  <input
                    value={lookName}
                    maxLength={100}
                    onChange={(e) => setLookName(e.target.value)}
                  />
                </label>
                <label>
                  Your identity photos · 1–5 PNG/JPEG files, up to 5 MB each
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 5) {
                        setError("Choose no more than five identity photos.");
                        return;
                      }
                      setIdentities(files);
                    }}
                  />
                </label>
                <p>
                  Use clear photos of the same person. Your face comes from
                  these photos; clothing, pose, light and room come from the
                  reference.
                </p>
                <div className="look-presets">
                  {presets.map(([id, name]) => (
                    <button
                      type="button"
                      key={id}
                      aria-pressed={!reference && preset === id}
                      onClick={() => {
                        setPreset(id);
                        setReference(null);
                      }}
                    >
                      <img
                        src={`/look-presets/${id}.png`}
                        alt={`${name} reference with a fictional presenter`}
                      />
                      <strong>{name}</strong>
                      <span>AI-generated reference</span>
                    </button>
                  ))}
                </div>
                <label>
                  Or upload your reference · exactly one person, whole head
                  visible
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => setReference(e.target.files?.[0] ?? null)}
                  />
                </label>
                {reference && <p>Using: {reference.name}</p>}
                <label className="creative-check">
                  <input
                    type="checkbox"
                    checked={rights}
                    onChange={(e) => setRights(e.target.checked)}
                  />
                  I have permission to use the person’s likeness and these
                  reference images.
                </label>
                <p>
                  Generating an image uses your HeyGen API balance. One image is
                  generated; no video or avatar test starts automatically.
                  Saving the approved image as a look may also use HeyGen
                  credits.
                </p>
                <button
                  className="button primary"
                  disabled={
                    !rights ||
                    !identities.length ||
                    !avatarId ||
                    !lookName.trim()
                  }
                  onClick={() => void run(generateLook)}
                >
                  Generate look image · paid
                </button>
              </fieldset>
              <div className="creative-history">
                {state.jobs
                  .filter((j) => ["image", "look"].includes(j.kind))
                  .map((job) => (
                    <article key={job.id}>
                      <h3>{job.title}</h3>
                      <JobProgress job={job} now={tick} />
                      {job.error && <p role="alert">{job.error}</p>}
                      {job.kind === "image" &&
                        safeUrl(job.result.images?.[0]?.image_url) && (
                          <img
                            className="generated-look"
                            src={job.result.images[0].image_url}
                            alt={job.title}
                          />
                        )}
                      <div className="creative-row">
                        <button
                          disabled={busy}
                          onClick={() => void run(() => refreshJob(job.id))}
                        >
                          Refresh status / image link
                        </button>
                        {job.kind === "image" && job.status === "completed" && (
                          <button
                            className="button primary"
                            disabled={
                              busy ||
                              state.jobs.some(
                                (j) =>
                                  j.kind === "look" &&
                                  j.title === job.title &&
                                  active(j),
                              )
                            }
                            onClick={() =>
                              void run(async () => {
                                await creativeRequest({
                                  action: "save_look",
                                  request_id: requestId(`save:${job.id}`),
                                  image_job_id: job.id,
                                  name: job.title,
                                  paid_consent: true,
                                });
                                await load();
                                notifyAvatarLibrary();
                              })
                            }
                          >
                            Approve & save avatar look
                          </button>
                        )}
                      </div>
                      {job.kind === "look" && job.status === "completed" && (
                        <p>
                          Saved in Avatar Library with the original voice.
                          Engines:{" "}
                          {(job.result.engines ?? []).join(", ") ||
                            "No supported engine reported yet"}
                          .
                        </p>
                      )}
                    </article>
                  ))}
              </div>
            </>
          )}
          {tab === "brands" && (
            <fieldset disabled={busy}>
              <h2>Import from your website</h2>
              <label>
                Brand name
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Public website
                <input
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={brandUrl}
                  onChange={(e) => setBrandUrl(e.target.value)}
                />
              </label>
              <p>
                Import only a website whose logos and fonts you have permission
                to use.
              </p>
              <button
                className="button primary"
                disabled={!brandUrl || !brandName}
                onClick={() =>
                  void run(async () => {
                    const job = await creativeRequest<CreativeJob>({
                      action: "import_kit",
                      connection_id: connectionId,
                      request_id: requestId(`kit:${brandUrl}:${brandName}`),
                      url: brandUrl,
                      name: brandName,
                      rights: true,
                    });
                    setKitId(job.provider_id ?? "");
                    await load();
                    setNotice(
                      "Import saved. It can take up to two minutes; refresh the kit when complete.",
                    );
                  })
                }
              >
                Import brand kit
              </button>
              {state.jobs
                .filter((j) => j.kind === "kit")
                .map((j) => (
                  <div key={j.id}>
                    <JobProgress job={j} now={tick} />
                    {j.error && <p>{j.error}</p>}
                    <button
                      onClick={() =>
                        void run(async () => {
                          await refreshJob(j.id);
                          await loadKits();
                          if (j.provider_id)
                            showKit(
                              await creativeRequest({
                                action: "kit",
                                connection_id: connectionId,
                                kit_id: j.provider_id,
                              }),
                            );
                        })
                      }
                    >
                      Refresh {j.title}
                    </button>
                  </div>
                ))}
              <h2>Choose a saved HeyGen kit</h2>
              <select
                aria-label="Saved brand kit"
                value={kitId}
                onChange={(e) => {
                  setKitId(e.target.value);
                  setKit(null);
                }}
              >
                <option value="">Choose a kit</option>
                {kits.map((k) => (
                  <option key={k.brand_kit_id} value={k.brand_kit_id}>
                    {k.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!kitId}
                onClick={() =>
                  void run(async () =>
                    showKit(
                      await creativeRequest({
                        action: "kit",
                        connection_id: connectionId,
                        kit_id: kitId,
                      }),
                    ),
                  )
                }
              >
                Preview / refresh kit
              </button>
              {cursor && (
                <button onClick={() => void run(() => loadKits(true))}>
                  Load more kits
                </button>
              )}
              {kit && (
                <>
                  <h3>
                    {kit.name} · {kit.status}
                  </h3>
                  <div className="brand-swatches">
                    {(kit.colors ?? []).map((c) => (
                      <span
                        key={c}
                        style={{
                          background: /^#[a-f0-9]{6}$/i.test(c) ? c : undefined,
                        }}
                        title={c}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="brand-assets">
                    {kit.logos?.map((l) => (
                      <div key={l.logo_id}>
                        {safeUrl(l.url) && (
                          <img src={l.url} alt={l.name ?? "Brand logo"} />
                        )}
                        <span>{l.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="creative-row">
                    {["primary", "secondary", "tertiary", "accent"].map(
                      (role) => (
                        <label key={role}>
                          {role} color
                          <input
                            placeholder="#1688FF"
                            value={colors[role] ?? ""}
                            onChange={(e) =>
                              setColors({ ...colors, [role]: e.target.value })
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                  <label>
                    Primary logo
                    <select
                      value={logo}
                      onChange={(e) => setLogo(e.target.value)}
                    >
                      <option value="">No logo</option>
                      {kit.logos?.map((l) => (
                        <option key={l.logo_id} value={l.logo_id}>
                          {l.name ?? l.logo_id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="creative-row">
                    {(
                      [
                        [
                          "Title font",
                          titleFont,
                          setTitleFont,
                          titleWeight,
                          setTitleWeight,
                        ],
                        [
                          "Body font",
                          bodyFont,
                          setBodyFont,
                          bodyWeight,
                          setBodyWeight,
                        ],
                      ] as const
                    ).map(([label, value, setValue, weight, setWeight]) => (
                      <label key={label}>
                        {label}
                        <select
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                        >
                          <option value="">Provider default</option>
                          {kit.fonts?.map((f) => (
                            <option key={f.font_id} value={f.font_id}>
                              {f.name ?? f.font_id}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label={`${label} weight`}
                          value={weight}
                          onChange={(e) => setWeight(Number(e.target.value))}
                        >
                          {[100, 200, 300, 400, 500, 600, 700, 800, 900].map(
                            (w) => (
                              <option key={w}>{w}</option>
                            ),
                          )}
                        </select>
                      </label>
                    ))}
                  </div>
                  <p>
                    Add or replace logo and font files in{" "}
                    <a
                      href="https://app.heygen.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      HeyGen Brand Kit
                    </a>
                    , then refresh here.
                  </p>
                  <button
                    disabled={kit.status !== "completed"}
                    onClick={() =>
                      void run(async () => {
                        showKit(
                          await creativeRequest({
                            action: "update_kit",
                            connection_id: connectionId,
                            kit_id: kit.brand_kit_id,
                            roles: {
                              color_roles: Object.fromEntries(
                                Object.entries(colors).filter(([, v]) => v),
                              ),
                              logo_roles: logo ? { primary: logo } : {},
                              font_roles: {
                                ...(titleFont
                                  ? {
                                      title_text: {
                                        font_id: titleFont,
                                        weight: titleWeight,
                                      },
                                    }
                                  : {}),
                                ...(bodyFont
                                  ? {
                                      body_text: {
                                        font_id: bodyFont,
                                        weight: bodyWeight,
                                      },
                                    }
                                  : {}),
                              },
                            },
                          }),
                        );
                        setNotice("Brand roles saved.");
                      })
                    }
                  >
                    Save brand roles
                  </button>
                  <button
                    className="button primary"
                    disabled={kit.status !== "completed"}
                    onClick={() =>
                      void run(async () => {
                        await creativeRequest({
                          action: "default_kit",
                          connection_id: connectionId,
                          kit_id: kit.brand_kit_id,
                        });
                        await load();
                        setNotice(
                          "Default brand kit saved for new AI-produced videos.",
                        );
                      })
                    }
                  >
                    Use as my default kit
                  </button>
                  <button
                    disabled={kit.status !== "completed"}
                    onClick={() =>
                      void run(async () => {
                        const response = await mediaFetch(
                          "/api/local-capture/template-brand",
                        );
                        if (!response.ok)
                          throw Error(
                            "Could not read your template brand defaults.",
                          );
                        const saved = await response.json();
                        const brand = {
                          ...(saved.brand ?? defaultEditBrand),
                          ...(kit.color_roles?.primary
                            ? { primary: kit.color_roles.primary }
                            : {}),
                          ...(kit.color_roles?.secondary
                            ? { text: kit.color_roles.secondary }
                            : {}),
                          ...(kit.color_roles?.tertiary
                            ? { background: kit.color_roles.tertiary }
                            : {}),
                        };
                        const result = await mediaFetch(
                          "/api/local-capture/template-brand",
                          {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              baseVersion: saved.version,
                              brand,
                            }),
                          },
                        );
                        if (!result.ok)
                          throw Error("Template colors could not save.");
                        setNotice(
                          "Copied primary → accent, secondary → text, tertiary → background; caption style preserved.",
                        );
                      })
                    }
                  >
                    Copy saved kit colors to Edit Studio
                  </button>
                  <p>
                    Copy maps primary to accent, secondary to text, and tertiary
                    to background. Existing edits keep their saved appearance.
                  </p>
                </>
              )}
            </fieldset>
          )}
          {tab === "agent" && (
            <>
              <fieldset disabled={busy}>
                {controls}
                <label>
                  Content Profile
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                  >
                    <option value="">Choose a profile</option>
                    {profiles
                      .filter((p) => !p.archived_at)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Brand kit
                  <select
                    value={kitId}
                    onChange={(e) => setKitId(e.target.value)}
                  >
                    <option value="">No kit</option>
                    {kits.map((k) => (
                      <option key={k.brand_kit_id} value={k.brand_kit_id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Video title
                  <input
                    maxLength={160}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setApproved(false);
                    }}
                  />
                </label>
                <label>
                  Source material / article notes
                  <textarea
                    value={source}
                    maxLength={12000}
                    onChange={(e) => {
                      setSource(e.target.value);
                      setApproved(false);
                    }}
                    placeholder="Paste the relevant source text or your research notes."
                  />
                </label>
                <label>
                  Your angle
                  <textarea
                    value={angle}
                    maxLength={2000}
                    onChange={(e) => {
                      setAngle(e.target.value);
                      setApproved(false);
                    }}
                  />
                </label>
                <label>
                  Approved script
                  <textarea
                    rows={10}
                    value={script}
                    maxLength={12000}
                    onChange={(e) => {
                      setScript(e.target.value);
                      setApproved(false);
                    }}
                  />
                </label>
                <label className="creative-check">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                  />
                  I approve this angle and script for storyboard planning.
                </label>
                <p>
                  HeyGen storyboard planning and revisions may use API credits.
                  Final video generation is a separate action after review.
                </p>
                <button
                  className="button primary"
                  disabled={
                    !approved ||
                    !title ||
                    !angle ||
                    !script ||
                    !profileId ||
                    !avatarId
                  }
                  onClick={() => void run(startAgent)}
                >
                  Prepare storyboard · paid processing
                </button>
              </fieldset>
              {current?.kind === "agent" && (
                <article>
                  <h2>{current.title}</h2>
                  <JobProgress job={current} now={tick} />
                  {current.error && <p role="alert">{current.error}</p>}
                  <button
                    disabled={busy}
                    onClick={() => void run(() => refreshJob(current.id))}
                  >
                    Refresh saved session
                  </button>
                  <div className="storyboard-messages">
                    {[...(current.result.messages ?? [])]
                      .reverse()
                      .map((m: any, i: number) => (
                        <p key={`${m.created_at}-${i}`}>
                          <strong>
                            {m.role === "model" ? "Storyboard" : "You"}:
                          </strong>{" "}
                          {m.content}
                        </p>
                      ))}
                  </div>
                  <div className="storyboard-resources">
                    {(current.result.resources ?? []).map((r: any) =>
                      r.resource_type === "image" && safeUrl(r.url) ? (
                        <img
                          key={r.resource_id}
                          src={r.url}
                          alt="Storyboard scene"
                        />
                      ) : r.resource_type === "video" && safeUrl(r.url) ? (
                        <video key={r.resource_id} controls src={r.url} />
                      ) : null,
                    )}
                  </div>
                  {["reviewing", "waiting_for_input"].includes(
                    current.status,
                  ) && (
                    <>
                      <label>
                        Changes to the storyboard
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                        />
                      </label>
                      <button
                        disabled={busy || !feedback.trim()}
                        onClick={() =>
                          void run(async () => {
                            await creativeRequest({
                              action: "agent_message",
                              job_id: current.id,
                              request_id: requestId(
                                `revision:${current.id}:${current.updated_at}:${feedback}`,
                              ),
                              message: feedback,
                              generate: false,
                              paid_consent: true,
                            });
                            setFeedback("");
                            await load();
                          })
                        }
                      >
                        Request revision · paid processing
                      </button>
                      <p>
                        Generating the finished video uses your HeyGen API
                        balance.
                      </p>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await creativeRequest({
                              action: "agent_message",
                              job_id: current.id,
                              request_id: requestId(
                                `approve:${current.id}:${current.updated_at}`,
                              ),
                              message: "Approved",
                              generate: true,
                              paid_consent: true,
                            });
                            await load();
                          })
                        }
                      >
                        Approve storyboard & generate video · paid
                      </button>
                    </>
                  )}
                  {current.status === "completed" && (
                    <button onClick={() => onTab("videos")}>
                      View finished video
                    </button>
                  )}
                </article>
              )}
            </>
          )}
          {tab === "videos" && (
            <div className="creative-history">
              {!state.jobs.some((j) => j.kind === "agent") && (
                <p>
                  Your AI-produced videos will appear here after storyboard
                  planning starts.
                </p>
              )}
              {state.jobs
                .filter((j) => j.kind === "agent")
                .map((job) => (
                  <article key={job.id}>
                    <h2>{job.title}</h2>
                    <JobProgress job={job} now={tick} />
                    {job.error && <p>{job.error}</p>}
                    {safeUrl(job.result.video?.video_url) && (
                      <video
                        controls
                        preload="metadata"
                        src={job.result.video.video_url}
                      />
                    )}
                    <div className="creative-row">
                      <button
                        disabled={busy}
                        onClick={() => void run(() => refreshJob(job.id))}
                      >
                        Refresh status / video link
                      </button>
                      <button
                        onClick={() => {
                          setCurrentId(job.id);
                          onTab("agent");
                        }}
                      >
                        Open storyboard
                      </button>
                      {safeUrl(job.result.video?.video_url) && (
                        <>
                          <a
                            className="button"
                            href={job.result.video.video_url}
                            target="_blank"
                            rel="noreferrer"
                            download
                          >
                            Download video
                          </a>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const r = await mediaFetch(
                                  "/api/local-capture/creative-import",
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({ jobId: job.id }),
                                  },
                                );
                                const result = await r.json();
                                if (!r.ok)
                                  throw Error(
                                    result.error ??
                                      "Could not prepare the video for Edit Studio.",
                                  );
                                setEditExport(result.id);
                              })
                            }
                          >
                            Open in Edit Studio
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
function JobProgress({ job, now }: { job: CreativeJob; now: number }) {
  const seconds = Math.max(
    0,
    Math.floor(
      ((active(job) ? now : Date.parse(job.updated_at)) -
        Date.parse(job.created_at)) /
        1000,
    ),
  );
  const percent =
    typeof job.result.progress === "number"
      ? Math.max(0, Math.min(100, job.result.progress))
      : undefined;
  return (
    <div role="status" className="creative-progress">
      <strong>
        {job.status.replaceAll("_", " ")}
        {percent !== undefined ? ` · ${percent}%` : ""}
      </strong>
      {active(job) && <progress max={100} value={percent} />}
      <span>
        {Math.floor(seconds / 60)}m {seconds % 60}s elapsed
      </span>
      {job.status === "submission_unknown" && (
        <p>
          Submission outcome is uncertain. Refresh before trying again; no
          automatic duplicate video is submitted.
        </p>
      )}
    </div>
  );
}
