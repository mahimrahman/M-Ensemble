import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { ApiError, uploadImage } from '@/api';

/**
 * The console's image picker.
 *
 * **It uploads on pick, not on save** — the same choice `PosterField` makes in
 * the app, for the same reason: choosing the image and writing the rest of the
 * form are two separate things a person does, and doing the slow one first
 * means the Save button only ever sends JSON. A button labelled "Save" cannot
 * then spend twenty seconds on a network upload, or fail for a reason that has
 * nothing to do with what was typed.
 *
 * The cost is an orphan file when somebody picks an image and abandons the
 * form. That is a sweep to write later, not a reason to make everyone wait at
 * the end.
 *
 * Drag-and-drop **and** a click target, because both are things people try. The
 * whole zone is a `<button>` so it is reachable by keyboard — a div with an
 * onClick is a control nobody tabbing can use.
 */

/** Mirrors `MAX_UPLOAD_BYTES` on the server, so the refusal is instant. */
const MAX_BYTES = 8 * 1024 * 1024;

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif';

export interface ImageUploadProps {
  /** The stored path, or undefined for nothing chosen. */
  value?: string;
  /** Fires with the new path, or undefined when the image is removed. */
  onChange: (url: string | undefined) => void;
  /**
   * When set, the upload is attributed to that mosque and goes through the
   * poster endpoint. Omit for a partner logo or a campaign creative, which
   * belong to no mosque and go through the platform endpoint instead.
   */
  mosqueId?: string;
  /** `logo` renders the preview small and transparent-backed. */
  shape?: 'wide' | 'logo';
  label?: string;
  hint?: string;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  mosqueId,
  shape = 'wide',
  label = 'Image',
  hint = 'JPEG, PNG or WebP, up to 8MB. Landscape crops best.',
  disabled,
}: ImageUploadProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string>();

  const send = useCallback(
    async (file: File) => {
      setError(undefined);

      // Checked here as well as on the server so an 8MB refusal is instant
      // rather than after the whole file has crossed the wire.
      if (file.size > MAX_BYTES) {
        setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 8MB.`);
        return;
      }

      setBusy(true);
      try {
        const stored = await uploadImage(file, mosqueId);
        onChange(stored.url);
      } catch (err) {
        // The server's own message is the useful one — "over 8MB", "not an
        // image we can read" — and it is written for a reader.
        setError(err instanceof ApiError ? err.message : 'That upload did not go through.');
      } finally {
        setBusy(false);
      }
    },
    [mosqueId, onChange],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (disabled || busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void send(file);
  };

  return (
    <div className="field">
      <span>{label}</span>

      {value ? (
        <div className={`preview${shape === 'logo' ? ' logo' : ''}`}>
          {/* Server-relative, and the console is same-origin with the API
              through the dev proxy — so the path renders as-is here, unlike in
              the app, which has to resolve it against its own base URL. */}
          <img src={value} alt="" />
          {busy ? (
            <div className="preview-veil">
              <Loader2 size={20} className="spin" />
              Uploading…
            </div>
          ) : (
            <button
              type="button"
              className="preview-remove"
              onClick={() => {
                onChange(undefined);
                setError(undefined);
              }}
              aria-label="Remove this image"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={`dropzone${over ? ' over' : ''}${disabled || busy ? ' disabled' : ''}`}
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled && !busy) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus size={22} strokeWidth={1.75} color="var(--brand)" />
              <span>
                <strong>Choose an image</strong> or drop one here
              </span>
              <small>{hint}</small>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so picking the *same* file twice still fires a change —
          // otherwise a failed upload cannot be retried with the same image.
          event.target.value = '';
          if (file) void send(file);
        }}
      />

      {error ? (
        <small style={{ color: 'var(--danger)' }}>{error}</small>
      ) : value ? (
        <small>Stored at {value}</small>
      ) : null}
    </div>
  );
}
