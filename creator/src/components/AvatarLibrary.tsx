import { useEffect, useState } from "react";
import { AvatarPicture } from './AvatarPicture';
import { avatarRepository as repo } from "../lib/avatar-repository";
import {
  usableAvatar,
  type AvatarLibrary as Library,
  type AvatarCatalog,
  type VoiceCatalog,
  type CatalogAvatar,
} from "../../supabase/functions/_shared/avatar-contract";

export function AvatarLibrary({
  preview,
  picker = false,
}: {
  preview: boolean;
  picker?: boolean;
}) {
  const [library, setLibrary] = useState<Library>({
    connections: [],
    avatars: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(preview);
  const [catalog, setCatalog] = useState<AvatarCatalog | null>(null);
  const [voices, setVoices] = useState<VoiceCatalog | null>(null);
  const [ownership, setOwnership] = useState<"private" | "public">("private");
  const [voiceType, setVoiceType] = useState<"private" | "public">("public");
  const [candidate, setCandidate] = useState<CatalogAvatar | null>(null);
  const [voice, setVoice] = useState("");
  const [selected, setSelected] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const connection = library.connections[0];
  const ready = library.avatars.filter((a) =>
    usableAvatar(a, library.connections),
  );
  const presenter =
    ready.find((a) => a.id === selected) ?? ready.find((a) => a.is_default);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    repo
      .library()
      .then((data) => {
        if (!cancelled) {
          setLibrary(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Could not load avatars. Check that the avatar service is configured, then retry.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);
  if (preview)
    return (
      <section className="next-stage">
        <h2>{picker ? "Choose your presenter" : "Your avatar library"}</h2>
        <p>
          Connect your Supabase project to securely link HeyGen and import
          presenters. Local preview never accepts or stores API keys.
        </p>
        <span className="coming-label">PROVIDER CONNECTION REQUIRED</span>
      </section>
    );
  return (
    <section className="avatar-library" aria-busy={busy}>
      {!picker && (
        <div className="page-heading">
          <div>
            <span className="eyebrow">A FAMILIAR FACE. YOUR PERSPECTIVE.</span>
            <h1>Your avatar library.</h1>
            <p>
              Connect HeyGen once. Choose the presenter and voice for each
              video.
            </p>
          </div>
        </div>
      )}
      {error && (
        <div role="alert" className="error-banner">
          {error}{" "}
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setLibrary(await repo.library());
                setLoaded(true);
              })
            }
          >
            Retry
          </button>
        </div>
      )}
      {!loaded && !error && <p role="status">Loading your presenters…</p>}
      {loaded && (
        <>
          {!picker && (
            <section className="create-panel">
              <h2>HeyGen connection</h2>
              <p>
                {connection
                  ? `${connection.account_label} · ${connection.status}`
                  : "No account connected yet."}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const key = String(new FormData(form).get("api_key") ?? "");
                  form.reset();
                  void run(async () => {
                    setLibrary(
                      await repo.change({
                        action: "connect",
                        provider: "heygen",
                        api_key: key,
                        expected_version: connection?.version ?? null,
                      }),
                    );
                    setCatalog(null);
                    setCandidate(null);
                  });
                }}
              >
                <label>
                  HeyGen API key
                  <input
                    name="api_key"
                    type="password"
                    autoComplete="off"
                    minLength={10}
                    maxLength={2048}
                    required
                    disabled={busy}
                  />
                </label>
                <p className="muted">
                  Encrypted on the server. Never saved in this browser.
                  Reconnecting disables old presenters until you import them
                  again.
                </p>
                <button className="button" disabled={busy}>
                  {connection ? "Reconnect HeyGen" : "Connect HeyGen"}
                </button>
              </form>
              {connection?.status !== "disconnected" && connection && (
                <div className="next-stage">
                  {confirmDisconnect ? (
                    <>
                      <p>
                        Disconnect HeyGen? Its saved credential will be removed
                        and imported presenters disabled.
                      </p>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            setLibrary(
                              await repo.change({
                                action: "disconnect",
                                connection_id: connection.id,
                                expected_version: connection.version,
                              }),
                            );
                            setCatalog(null);
                            setCandidate(null);
                            setConfirmDisconnect(false);
                          })
                        }
                      >
                        Confirm disconnect
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setConfirmDisconnect(false)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setConfirmDisconnect(true)}
                    >
                      Disconnect account
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
          {!picker && connection?.status === "connected" && (
            <section className="create-panel">
              <h2>Import a presenter</h2>
              <label>
                Avatar collection
                <select
                  value={ownership}
                  disabled={busy}
                  onChange={(e) => {
                    setOwnership(e.target.value as "private" | "public");
                    setCatalog(null);
                    setCandidate(null);
                  }}
                >
                  <option value="private">My avatars</option>
                  <option value="public">Public avatars</option>
                </select>
              </label>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    setCatalog(await repo.catalog(connection.id, ownership)),
                  )
                }
              >
                Browse avatars
              </button>
              {catalog && (
                <div className="avatar-picture-grid">
                  {!catalog.items.length && (
                    <p>No avatars found in this collection.</p>
                  )}
                  {catalog.items.map((a) => (
                    <button
                      key={a.provider_avatar_id}
                      aria-pressed={candidate?.provider_avatar_id === a.provider_avatar_id}
                      disabled={busy || a.status !== "ready"}
                      className={
                        candidate?.provider_avatar_id === a.provider_avatar_id
                          ? "chosen"
                          : ""
                      }
                      onClick={() => {
                        setCandidate(a);
                        setVoice(a.default_voice_id ?? "");
                      }}
                    >
                      <AvatarPicture url={a.thumbnail_url} name={a.name}/>
                      <strong>{a.name}</strong>
                      <small>{a.status}</small>
                    </button>
                  ))}
                  {catalog.next_token && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const next = await repo.catalog(
                            connection.id,
                            ownership,
                            catalog.next_token!,
                          );
                          setCatalog({
                            items: [...catalog.items, ...next.items],
                            next_token: next.next_token,
                          });
                        })
                      }
                    >
                      Load more avatars
                    </button>
                  )}
                </div>
              )}
              {candidate && (
                <form
                  key={candidate.provider_avatar_id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = String(
                      new FormData(event.currentTarget).get("name"),
                    );
                    void run(async () => {
                      setLibrary(
                        await repo.change({
                          action: "import",
                          connection_id: connection.id,
                          provider_avatar_id: candidate.provider_avatar_id,
                          provider_voice_id: voice || null,
                          name,
                        }),
                      );
                      setCandidate(null);
                    });
                  }}
                >
                  <label>
                    Presenter name
                    <input
                      name="name"
                      defaultValue={candidate.name}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Voice collection
                    <select
                      value={voiceType}
                      disabled={busy}
                      onChange={(e) => {
                        setVoiceType(e.target.value as "private" | "public");
                        setVoices(null);
                      }}
                    >
                      <option value="public">Public voices</option>
                      <option value="private">My voices</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () =>
                        setVoices(await repo.voices(connection.id, voiceType)),
                      )
                    }
                  >
                    Browse voices
                  </button>
                  <label>
                    Presenter voice
                    <select
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                    >
                      <option value="">Use avatar’s default voice</option>
                      {candidate.default_voice_id && (
                        <option value={candidate.default_voice_id}>
                          Avatar’s default voice
                        </option>
                      )}
                      {voices?.items
                        .filter(
                          (v) =>
                            v.provider_voice_id !== candidate.default_voice_id,
                        )
                        .map((v) => (
                          <option
                            key={v.provider_voice_id}
                            value={v.provider_voice_id}
                          >
                            {v.name}
                            {v.language ? ` · ${v.language}` : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  {voices?.next_token && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const next = await repo.voices(
                            connection.id,
                            voiceType,
                            voices.next_token!,
                          );
                          setVoices({
                            items: [...voices.items, ...next.items],
                            next_token: next.next_token,
                          });
                        })
                      }
                    >
                      Load more voices
                    </button>
                  )}
                  <button className="button" disabled={busy}>
                    Import presenter
                  </button>
                </form>
              )}
            </section>
          )}
          <div
            className="profile-choices"
            role={picker ? "radiogroup" : undefined}
            aria-label="Imported presenters"
          >
            {(picker ? ready : library.avatars).map((a) => (
              <div className="create-panel" key={a.id}>
                <AvatarPicture url={a.thumbnail_url} name={a.name}/>
                <h3>{a.name}</h3>
                <p>
                  {a.voice_name ?? "Voice not set"} · {a.status}
                  {a.is_default ? " · Default" : ""}
                </p>
                {picker ? (
                  <button
                    className="button"
                    role="radio"
                    aria-checked={presenter?.id === a.id}
                    onClick={() => setSelected(a.id)}
                  >
                    {presenter?.id === a.id ? "Selected" : "Choose presenter"}
                  </button>
                ) : (
                  <button
                    className="text-button"
                    disabled={
                      busy ||
                      a.is_default ||
                      !usableAvatar(a, library.connections)
                    }
                    onClick={() =>
                      void run(async () =>
                        setLibrary(
                          await repo.change({
                            action: "default",
                            avatar_id: a.id,
                          }),
                        ),
                      )
                    }
                  >
                    Make default
                  </button>
                )}
              </div>
            ))}
            {!(picker ? ready : library.avatars).length && (
              <p className="muted">
                {picker
                  ? "Import a ready presenter from Avatar library to continue."
                  : "Your imported presenters will appear here."}
              </p>
            )}
          </div>
          {picker && presenter && (
            <p role="status">
              {presenter.name} is selected for this session. Source upload is
              the next milestone; no video generation has started.
            </p>
          )}
        </>
      )}
    </section>
  );
}
