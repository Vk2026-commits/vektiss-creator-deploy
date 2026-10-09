import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { X, ArrowRight, LoaderCircle } from "lucide-react";
import {
  creatorInputSchema,
  emptyCreator,
  explainError,
  splitItems,
  type CreatorInput,
} from "../domain/strategy";

export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      <div className="dialog-head">
        <div>
          <span className="eyebrow">YOUR STRATEGY</span>
          <h2 id="dialog-title">{title}</h2>
          <p id="dialog-description">{description}</p>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function Field({
  name,
  title,
  value,
  placeholder,
  required = false,
  multiline = false,
  maxLength = 2000,
  hint,
}: {
  name: string;
  title: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>
        {title}
        {!required && <small>Optional</small>}
      </span>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={value}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          rows={3}
        />
      ) : (
        <input
          name={name}
          defaultValue={value}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function FormFooter({
  busy,
  error,
  label,
  onCancel,
  hideCancel = false,
}: {
  busy: boolean;
  error: string;
  label: string;
  onCancel: () => void;
  hideCancel?: boolean;
}) {
  return (
    <footer className="form-footer">
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div>
        {!hideCancel && <button
          type="button"
          className="button secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>}
        <button className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <ArrowRight size={16} />
          )}
          {busy ? "Saving…" : label}
        </button>
      </div>
    </footer>
  );
}

export function CreatorForm({
  initial = emptyCreator,
  onSave,
  onClose,
  onboarding = false,
}: {
  initial?: CreatorInput;
  onSave: (value: CreatorInput) => Promise<void>;
  onClose: () => void;
  onboarding?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "");
    try {
      await onSave(
        creatorInputSchema.parse({
          display_name: get("display_name"),
          bio: get("bio"),
          context: {
            expertise: get("expertise"),
            experience: get("experience"),
            industries: splitItems(get("industries")),
            credentials: get("credentials"),
            tone: splitItems(get("tone")),
            communication_style: get("communication_style"),
            phrases_to_avoid: splitItems(get("phrases_to_avoid")),
            preferred_cta_style: get("preferred_cta_style"),
            additional_context: get("additional_context"),
          },
        }),
      );
      onClose();
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="form-body">
        <Field
          name="display_name"
          title="What should we call you?"
          value={initial.display_name}
          placeholder="Your name"
          required
          maxLength={100}
        />
        <Field
          name="expertise"
          title="What do you know deeply?"
          value={initial.context.expertise}
          placeholder="Your work, experience, or a subject you could talk about for hours."
          multiline
        />
        <Field
          name="tone"
          title="What should you sound like?"
          value={initial.context.tone.join("\n")}
          placeholder={"Calm\nDirect\nEducational"}
          multiline
          maxLength={3220}
          hint="One tone per line. You can refine this later."
        />
        <details>
          <summary>
            A little more about you <span>Experience, voice & preferences</span>
          </summary>
          <div className="extra-fields">
            <Field
              name="bio"
              title="Short biography"
              value={initial.bio}
              multiline
            />
            <Field
              name="experience"
              title="Experience"
              value={initial.context.experience}
              multiline
              placeholder="The experience that shapes your perspective."
            />
            <Field
              name="industries"
              title="Industries"
              value={initial.context.industries.join("\n")}
              multiline
              maxLength={3220}
              hint="One per line."
            />
            <Field
              name="credentials"
              title="Credentials or context"
              value={initial.context.credentials}
              multiline
            />
            <Field
              name="communication_style"
              title="Your way of explaining things"
              value={initial.context.communication_style}
              multiline
            />
            <Field
              name="phrases_to_avoid"
              title="Phrases to avoid"
              value={initial.context.phrases_to_avoid.join("\n")}
              multiline
              maxLength={3220}
              hint="One per line."
            />
            <Field
              name="preferred_cta_style"
              title="How you invite people to take action"
              value={initial.context.preferred_cta_style}
              maxLength={500}
            />
            <Field
              name="additional_context"
              title="Anything else Vektiss should understand?"
              value={initial.context.additional_context}
              multiline
              maxLength={5000}
            />
          </div>
        </details>
      </fieldset>
      <FormFooter
        busy={busy}
        error={error}
        label="Save creator profile"
        onCancel={onClose}
        hideCancel={onboarding}
      />
    </form>
  );
}

export {ContentForm} from './GuidedContentForm';
