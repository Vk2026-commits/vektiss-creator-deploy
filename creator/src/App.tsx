import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { authRedirectUrl } from './lib/auth-redirect';
import { signInError } from './lib/auth-errors';
import { AvatarLibrary } from "./components/AvatarLibrary";
import { Scripts } from "./components/Scripts";
import { ProjectCosts } from './components/ProjectCosts';
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Compass,
  Edit3,
  Film,
  Layers3,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  UserRound,
  UsersRound,
  X,
  Archive,
  RotateCcw,
} from "lucide-react";
import { localPreviewAvailable, supabase } from "./lib/supabase";
import {
  createSupabaseRepository,
  type StrategyRepository,
} from "./lib/repository";
import {
  selectedProfile,
  explainError,
  type ContentProfile,
  type Workspace,
} from "./domain/strategy";
import { ContentForm, CreatorForm, Modal } from "./components/StrategyForms";

function Brand() {
  return (
    <div className="brand" aria-label="Vektiss Creator">
      <span className="brand-lockup"><img src="/brand/vektiss-lockup-light.png" alt="Vektiss" /></span>
      <span className="brand-product">CREATOR</span>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).has("error")
      ? "That sign-in link is invalid or expired. Request a new one below."
      : "",
  );
  const [preview, setPreview] = useState(false);
  const [previewRepo, setPreviewRepo] = useState<StrategyRepository | null>(
    null,
  );
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    let eventSeen = false;
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      eventSeen = true;
      if (live) {
        setSession(value);
        setLoading(false);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (live && !eventSeen) {
          setSession(data.session);
          if (error)
            setAuthError(
              "Your session couldn’t be restored. Please sign in again.",
            );
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) {
          setAuthError("Couldn’t reach sign-in. Reload to retry.");
          setLoading(false);
        }
      });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const repo = useMemo(
    () =>
      session && supabase
        ? createSupabaseRepository(supabase, session.user.id)
        : null,
    [session?.user.id],
  );
  async function enterPreview() {
    if (!localPreviewAvailable) return;
    const { createPreviewRepository } =
      await import("./lib/preview-repository");
    setPreviewRepo(createPreviewRepository());
    setPreview(true);
  }
  async function signOut() {
    if (preview) {
      setPreview(false);
      setPreviewRepo(null);
      return;
    }
    const { error } = await supabase!.auth.signOut();
    if (error) throw error;
  }
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <LoaderCircle className="spin" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (preview && previewRepo)
    return (
      <CreatorWorkspace
        key="preview"
        repo={previewRepo}
        userId="local-preview"
        email="Local preview"
        preview
        onSignOut={signOut}
      />
    );
  if (session && repo)
    return (
      <CreatorWorkspace
        key={session.user.id}
        repo={repo}
        userId={session.user.id}
        email={session.user.email ?? "Your account"}
        onSignOut={signOut}
      />
    );
  return <SignIn onPreview={enterPreview} initialError={authError} />;
}

function SignIn({
  onPreview,
  initialError,
}: {
  onPreview: () => Promise<void>;
  initialError: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(initialError);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: authRedirectUrl(window.location.origin) },
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      setError(signInError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">YOUR PERSPECTIVE. BROUGHT TO LIFE.</span>
          <h1>
            You bring
            <br />
            the expertise.
            <br />
            <em>
              We bring it
              <br />
              together.
            </em>
          </h1>
          <p>
            A creative home for what you know,
            <br />
            who you help, and what you want to say.
          </p>
        </div>
        <p className="auth-footer">STRATEGY FIRST. ALWAYS.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="mini-icon">
            <Sparkles size={24} />
          </span>
          <h2>
            {supabase
              ? sent
                ? "Check your inbox."
                : "Sign in to Creator."
              : "Your Creator workspace starts here."}
          </h2>
          {supabase ? (
            sent ? (
              <>
                <p>
                  We sent a sign-in link to <strong>{email}</strong>. Open it to
                  enter your workspace. Open the link on this computer and
                  continue in the browser where it opens. Signing in there
                  does not sign in this browser automatically.
                </p>
                <button
                  className="button secondary"
                  onClick={() => setSent(false)}
                >
                  Use a different email
                </button>
              </>
            ) : (
              <>
                <p>Sign in or create an account with a secure email link.</p>
                <form onSubmit={submit}>
                  <label className="field">
                    <span>Email address</span>
                    <input
                      autoComplete="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                    />
                  </label>
                  <button className="button primary" disabled={busy}>
                    {busy ? "Sending…" : "Continue with email"}
                    <ArrowRight size={17} />
                  </button>
                </form>
              </>
            )
          ) : (
            <>
              <p>
                The strategy foundation is ready for a dedicated Supabase
                connection. Account sign-in will become available once it is
                configured.
              </p>
              <div className="setup-note">
                <ShieldCheck size={20} />
                <div>
                  <strong>Private by design</strong>
                  <p>
                    Your creator identity and audiences will belong to your own
                    account.
                  </p>
                </div>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          {localPreviewAvailable && (
            <div className="preview-entry">
              <button
                className="text-button"
                onClick={() =>
                  void onPreview().catch(() =>
                    setError("Local preview could not open. Try reloading."),
                  )
                }
              >
                Explore the local preview <ArrowUpRight size={16} />
              </button>
              <small>Sample data · saved only in this browser</small>
            </div>
          )}
        </div>
        <p className="auth-bottom">
          Your expertise. Your audience. Your voice.
        </p>
      </section>
    </main>
  );
}

type Page = "profiles" | "creator" | "create" | "avatars" | "costs";
function CreatorWorkspace({
  repo,
  userId,
  email,
  preview = false,
  onSignOut,
}: {
  repo: StrategyRepository;
  userId: string;
  email: string;
  preview?: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [data, setData] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("create");
  const [costAdmin, setCostAdmin] = useState(false);
  useEffect(() => {
    let live = true;
    setCostAdmin(false);
    if (!preview && supabase) void supabase.rpc('creator_is_cost_admin').then(({data,error}) => {
      if (live) setCostAdmin(!error && data === true);
    });
    return () => { live = false; };
  }, [userId, preview]);
  const [choosingAudience,setChoosingAudience]=useState(false);
  const [audienceChoice,setAudienceChoice]=useState<{id:string;version:number}|null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [contentEdit, setContentEdit] = useState<ContentProfile | "new" | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const selectionKey = `vektiss-creator:selected:${userId}`;
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(selectionKey);
    } catch {
      return null;
    }
  });
  const load = useCallback(async () => {
    const next = await repo.load();
    setData(next);
    return next;
  }, [repo]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    repo
      .load()
      .then((next) => {
        if (live) setData(next);
      })
      .catch(() => {
        if (live)
          setError(
            "Your workspace couldn’t load. Check your connection and try again.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [repo]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const selected = selectedProfile(
    data?.profiles ?? [],
    selectedId,
    data?.creator?.default_content_profile_id ?? null,
  );
  const active = data?.profiles.filter((p) => !p.archived_at) ?? [];
  const visible =
    data?.profiles.filter(
      (p) =>
        Boolean(p.archived_at) === showArchived &&
        `${p.name} ${p.primary_audience}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  function select(profile: ContentProfile) {
    setSelectedId(profile.id);
    try {
      localStorage.setItem(selectionKey, profile.id);
    } catch {
      /* Selection remains available for this session. */
    }
    if(choosingAudience)setAudienceChoice(value=>({id:profile.id,version:(value?.version??0)+1}));
    setChoosingAudience(false);setPage("create");
  }
  async function action(fn: () => Promise<void>, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      setNotice(message);
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(false);
    }
  }
  const creator = data?.creator;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          <span className="workspace-avatar">
            {creator?.display_name.slice(0, 1) ?? "V"}
          </span>
          <div>
            {creator?.display_name ?? "Your workspace"}
            <small>Creator workspace</small>
          </div>
        </div>
        <button className="button new-video" onClick={() => {setPage("create");window.dispatchEvent(new Event('creator:new-video'));}}>
          <Plus size={18} /> Create a video <span>↗</span>
        </button>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation">
          <button className={page === 'create' ? 'active' : ''} onClick={() => setPage('create')}><Edit3 size={18} /> My videos</button>
          <button
            className={page === "profiles" ? "active" : ""}
            onClick={() => setPage("profiles")}
          >
            <Layers3 size={19} />
            Content Profiles<span className="nav-count">{active.length}</span>
          </button>
          <button
            className={page === "creator" ? "active" : ""}
            onClick={() => setPage("creator")}
          >
            <UserRound size={19} />
            Creator profile
          </button>
          <button
            className={page === "avatars" ? "active" : ""}
            onClick={() => setPage("avatars")}
          >
            <UsersRound size={19} />
            Avatar library
          </button>
        </nav>
        {costAdmin && <><span className="nav-caption">ADMIN</span><nav aria-label="Admin navigation"><button className={page === 'costs' ? 'active' : ''} onClick={() => setPage('costs')}><Layers3 size={18}/> Project costs</button></nav></>}
        <span className="nav-caption upcoming-caption">COMING NEXT</span>
        <div className="upcoming">
          <span>
            <Film size={18} />
            Your projects
          </span>
        </div>
        <div className="sidebar-bottom">
          <div className="team-note">
            <span className="little-stars">✧</span>
            <strong>Built around your perspective.</strong>
            <p>
              Your strategy is the starting point for everything you create.
            </p>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            How Creator works
            <ArrowUpRight size={14} />
          </button>
          <button
            className="account-button"
            disabled={busy}
            onClick={() => void action(onSignOut, "")}
          >
            <span>{email}</span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div>
            Workspace
            <ChevronRight size={14} />
            <strong>
              {page === "profiles"
                ? "Content Profiles"
                : page === "creator"
                  ? "Creator profile"
                  : page === "avatars" ? "Avatar library" : page === 'costs' ? 'Project costs' : "Create video"}
            </strong>
          </div>
          <span className="foundation-badge">
            <span />
            Strategy foundation
          </span>
          <button
            className="mobile-signout icon-button"
            aria-label={preview ? "Leave local preview" : "Sign out"}
            disabled={busy}
            onClick={() => void action(onSignOut, "")}
          >
            <LogOut size={17} />
          </button>
        </header>
        {preview && (
          <div className="preview-banner">
            <span>
              <strong>Local preview</strong> Sample data stays in this browser.
              Sign-in and video generation are not connected.
            </span>
            <button onClick={() => void onSignOut()}>
              Exit preview
              <X size={14} />
            </button>
          </div>
        )}
        <main id="main" className="main-content">
          {error && (
            <div role="alert" className="error-banner">
              <span>{error}</span>
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {}, "Workspace reloaded.")
                }
              >
                Reload
              </button>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="empty-state">
              <LoaderCircle className="spin" />
              <h2>Getting your strategy ready…</h2>
            </div>
          ) : !data ? (
            <div className="empty-state">
              <Compass size={36} />
              <h2>Let’s reconnect.</h2>
              <p>Your workspace is unavailable right now.</p>
              <button
                className="button primary"
                onClick={() => void action(async () => {}, "Workspace loaded.")}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {page === "avatars" && <AvatarLibrary preview={preview} />}
              {page === 'costs' && costAdmin && <ProjectCosts/>}
              {page === "profiles" && (
                <>
                  {choosingAudience&&<button type="button" className="text-button" onClick={()=>{setChoosingAudience(false);setPage('create');}}>← Back to your video</button>}
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        THE PEOPLE BEHIND THE CONTENT
                      </span>
                      <h1>Who are we creating for?</h1>
                      <p>
                        One creator. Different audiences. A clear strategy for
                        each.
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() =>
                        creator ? setContentEdit("new") : setCreatorOpen(true)
                      }
                    >
                      <Plus size={17} />
                      New Content Profile
                    </button>
                  </div>
                  {!creator ? (
                    <div className="onboarding-card">
                      <span className="mini-icon">
                        <UserRound size={24} />
                      </span>
                      <div>
                        <span className="eyebrow">START WITH YOU</span>
                        <h2>Every great perspective has a person behind it.</h2>
                        <p>
                          Tell Vektiss your name, what you know, and how you
                          speak. Then choose who you want to help.
                        </p>
                        <button
                          className="button primary"
                          onClick={() => setCreatorOpen(true)}
                        >
                          Set up my creator profile
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="strategy-strip">
                        <span className="strip-symbol">
                          <Compass size={24} />
                        </span>
                        <div>
                          <strong>
                            Your audience is your creative compass.
                          </strong>
                          <p>
                            Each Content Profile brings your audience, topics,
                            and point of view together.
                          </p>
                        </div>
                        <span className="strip-line" />
                        <div className="strip-stat">
                          <strong>
                            {String(active.length).padStart(2, "0")}
                          </strong>
                          <span>
                            active{" "}
                            {active.length === 1 ? "profile" : "profiles"}
                          </span>
                        </div>
                      </div>
                      <div className="collection-toolbar">
                        <div className="tabs">
                          <button
                            className={!showArchived ? "selected" : ""}
                            onClick={() => setShowArchived(false)}
                          >
                            Your profiles <span>{active.length}</span>
                          </button>
                          <button
                            className={showArchived ? "selected" : ""}
                            onClick={() => setShowArchived(true)}
                          >
                            Archived
                          </button>
                        </div>
                        <label className="search">
                          <Search size={17} />
                          <input
                            aria-label="Search Content Profiles"
                            placeholder="Find a profile…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="profile-grid">
                        {visible.map((profile, index) => (
                          <article className="profile-card" key={profile.id}>
                            <div className="card-top">
                              <span
                                className={`profile-icon tone-${index % 3}`}
                              >
                                {index % 2 === 0 ? (
                                  <ShieldCheck size={23} />
                                ) : (
                                  <UsersRound size={23} />
                                )}
                              </span>
                              {creator.default_content_profile_id ===
                                profile.id && (
                                <span className="default-tag">
                                  <Star size={11} fill="currentColor" />
                                  Default
                                </span>
                              )}
                              <button
                                className="icon-button"
                                aria-label={`Edit ${profile.name}`}
                                onClick={() => setContentEdit(profile)}
                              >
                                <Edit3 size={16} />
                              </button>
                            </div>
                            <h2>{profile.name}</h2>
                            <p className="audience">
                              {profile.primary_audience}
                            </p>
                            <details className="profile-card-details">
                            <summary>Profile details</summary>
                            <p className="profile-full-audience">{profile.primary_audience}</p>
                            <span className="card-label">CONTENT PILLARS</span>
                            <div className="tags">
                              {profile.strategy.content_pillars.length ? (
                                profile.strategy.content_pillars
                                  .slice(0, 3)
                                  .map((topic) => (
                                    <span key={topic}>{topic}</span>
                                  ))
                              ) : (
                                <span className="muted-tag">
                                  Add your topics
                                </span>
                              )}
                              {profile.strategy.content_pillars.length > 3 && (
                                <span>
                                  +{profile.strategy.content_pillars.length - 3}
                                </span>
                              )}
                            </div>
                            <div className="card-tone">
                              <AudioLines size={15} />
                              <span>
                                {profile.strategy.tone
                                  .slice(0, 3)
                                  .join(" · ") || "Your creator voice"}
                              </span>
                            </div>
                            </details>
                            <footer>
                              {profile.archived_at ? (
                                <button
                                  disabled={busy}
                                  className="text-button"
                                  onClick={() =>
                                    void action(
                                      () => repo.archive(profile, false),
                                      "Content Profile restored.",
                                    )
                                  }
                                >
                                  <RotateCcw size={15} />
                                  Restore profile
                                </button>
                              ) : (
                                <button
                                  className="use-profile"
                                  onClick={() => select(profile)}
                                >
                                  {choosingAudience?'Use this audience':'Create a video'}
                                  <ArrowRight size={17} />
                                </button>
                              )}
                              <div className="card-secondary-actions">
                                {!profile.archived_at &&
                                  creator.default_content_profile_id !==
                                    profile.id && (
                                    <button
                                      disabled={busy}
                                      onClick={() =>
                                        void action(
                                          () =>
                                            repo.setDefault(
                                              profile.id,
                                              creator,
                                            ),
                                          "Default Content Profile updated.",
                                        )
                                      }
                                    >
                                      Set as default
                                    </button>
                                  )}
                                {!profile.archived_at && (
                                  <button
                                    disabled={busy}
                                    aria-label={`Archive ${profile.name}`}
                                    onClick={() =>
                                      void action(
                                        () => repo.archive(profile, true),
                                        "Profile archived. You can restore it from Archived.",
                                      )
                                    }
                                  >
                                    <Archive size={13} />
                                    Archive
                                  </button>
                                )}
                              </div>
                            </footer>
                          </article>
                        ))}
                        {!showArchived && !query && (
                          <button
                            className="add-profile-card"
                            onClick={() => setContentEdit("new")}
                          >
                            <span>
                              <Plus size={24} />
                            </span>
                            <strong>A different audience?</strong>
                            <p>Give it a strategy of its own.</p>
                            <span className="add-profile-link">
                              Create a Content Profile
                              <ArrowUpRight size={16} />
                            </span>
                          </button>
                        )}
                      </div>
                      {visible.length === 0 && (showArchived || query) && (
                        <div className="empty-state compact">
                          <Search size={26} />
                          <h2>
                            {query
                              ? "No profiles found."
                              : "No archived profiles."}
                          </h2>
                          <p>
                            {query
                              ? "Try a different name or audience."
                              : "Profiles you archive will be kept here."}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  <div className="philosophy">
                    <span>✦</span>
                    <p>
                      You own the expertise.
                      <br />
                      <strong>Vektiss understands the strategy.</strong>
                    </p>
                    <small>
                      From your perspective
                      <br />
                      to their next useful idea.
                    </small>
                  </div>
                </>
              )}
              {page === "creator" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">THE EXPERT BEHIND IT ALL</span>
                      <h1>Your perspective starts with you.</h1>
                      <p>
                        The experience and voice that connect every Content
                        Profile.
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => setCreatorOpen(true)}
                    >
                      <Edit3 size={16} />
                      {creator ? "Edit creator profile" : "Set up my profile"}
                    </button>
                  </div>
                  {creator ? (
                    <div className="creator-layout">
                      <article className="identity-card">
                        <span className="identity-avatar">
                          {creator.display_name.slice(0, 1)}
                        </span>
                        <h2>{creator.display_name}</h2>
                        <p>{creator.bio || "Your creator identity"}</p>
                        <div className="tags">
                          {creator.context.tone.map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                      </article>
                      <article className="detail-card">
                        <Detail
                          label="YOUR EXPERTISE"
                          value={creator.context.expertise}
                        />
                        <Detail
                          label="YOUR EXPERIENCE"
                          value={creator.context.experience}
                        />
                        <Detail
                          label="HOW YOU COMMUNICATE"
                          value={creator.context.communication_style}
                        />
                        <Detail
                          label="WHAT TO AVOID"
                          value={creator.context.phrases_to_avoid.join(" · ")}
                        />
                        <Detail
                          label="YOUR INVITATION TO TAKE ACTION"
                          value={creator.context.preferred_cta_style}
                        />
                      </article>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <UserRound size={32} />
                      <h2>Let Vektiss get to know you.</h2>
                      <p>
                        A name, a little expertise, and your preferred tone are
                        a great start.
                      </p>
                    </div>
                  )}
                </>
              )}
              <div hidden={page !== 'create'}><Scripts profiles={data?.profiles ?? []} selectedId={selected?.id ?? null} userId={userId} preview={preview} audienceChoice={audienceChoice} onAddAudience={()=>{setChoosingAudience(true);setShowArchived(false);setQuery('');setPage('profiles');document.getElementById('main')?.scrollIntoView({block:'start'});}} /></div>
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>VEKTISS CREATOR</span>
          <span>Good content starts with a clear point of view.</span>
        </footer>
      </div>
      {notice && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {creatorOpen && (
        <Modal
          title={
            creator ? "Make it sound like you." : "Tell us a little about you."
          }
          description="Start with what matters. You can add more context anytime."
          onClose={() => setCreatorOpen(false)}
        >
          <CreatorForm
            initial={creator ?? undefined}
            onClose={() => setCreatorOpen(false)}
            onSave={async (value) => {
              const result = await repo.saveCreator(value, creator ?? null);
              setData((current) => ({
                creator: result,
                profiles: current?.profiles ?? [],
              }));
              setNotice("Creator profile saved.");
            }}
          />
        </Modal>
      )}
      {contentEdit && creator && (
        <Modal
          title={
            contentEdit === "new"
              ? "A strategy for your audience."
              : "Refine this Content Profile."
          }
          description="Who you help, what they care about, and the perspective you bring."
          onClose={() => setContentEdit(null)}
        >
          <ContentForm
            initial={contentEdit === "new" ? undefined : contentEdit}
            onClose={() => setContentEdit(null)}
            onSave={async (value) => {
              const result = await repo.saveContent(
                value,
                creator.id,
                contentEdit === "new" ? undefined : contentEdit,
              );
              setData((current) =>
                current
                  ? {
                      ...current,
                      profiles: [
                        ...current.profiles.filter((p) => p.id !== result.id),
                        result,
                      ],
                    }
                  : current,
              );
              setNotice("Content Profile saved.");
              if(choosingAudience){select(result);setContentEdit(null);}
            }}
          />
        </Modal>
      )}
      {help && (
        <Modal
          title="A creative team that knows your strategy."
          description="You shape the message. Vektiss will handle how it becomes a video."
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            {[
              [
                "01",
                "Your strategy",
                "Define your expertise and the audiences you speak to. Available in this milestone.",
              ],
              [
                "02",
                "Your presenter and source",
                "Connect your HeyGen avatar and upload a video or image. Planned next.",
              ],
              [
                "03",
                "Your perspective",
                "Review a recommended angle and approve what you want to say. Planned.",
              ],
              [
                "04",
                "Your finished video",
                "Let Vektiss plan the edit, then request changes in plain language. Planned.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <section>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </section>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span className="card-label">{label}</span>
      <p className={!value ? "muted" : ""}>
        {value || "Add this whenever you’re ready."}
      </p>
    </div>
  );
}
