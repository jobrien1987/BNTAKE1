'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Select } from '@/components/ui/form';
import { buttonClasses } from '@/components/ui/button';

const CATEGORIES = [
  { value: 'IMAGE', label: 'Image' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'DOCUMENT', label: 'Document' },
];

/**
 * Uploads go straight to the API route rather than through a server action,
 * because actions buffer the whole body and audio/video files are large.
 */
export function MediaUploader() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'uploading'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('Choose a file first.');
      return;
    }

    setStatus('uploading');
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Upload failed.');
      } else {
        setMessage(`Uploaded ${data.fileName}.`);
        form.reset();
        router.refresh();
      }
    } catch {
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel space-y-5 p-6">
      <h2 className="border-b border-ink-700 pb-4 font-display text-lg uppercase tracking-tight text-bone">
        Upload media
      </h2>

      {error ? (
        <div
          role="status"
          className="rounded-sm border border-blood/50 bg-blood/10 px-4 py-3 text-sm text-[#ffb3b8]"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          role="status"
          className="rounded-sm border border-jade/40 bg-jade/10 px-4 py-3 text-sm text-[#8ff0c4]"
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Category" name="category" required>
          <Select id="category" name="category" defaultValue="IMAGE" required>
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Alt text" name="altText" hint="Describes the file for screen readers.">
          <input
            id="altText"
            name="altText"
            className="h-11 w-full rounded-sm border border-ink-600 bg-ink-800 px-3 text-sm text-bone focus:border-gold-700 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
          />
        </Field>
      </div>

      <Field label="File" name="file" required>
        <input
          id="file"
          name="file"
          type="file"
          required
          className="w-full text-sm text-bone-muted file:mr-4 file:rounded-sm file:border-0 file:bg-gold-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.14em] file:text-ink hover:file:bg-gold-400"
        />
      </Field>

      <button type="submit" disabled={status === 'uploading'} className={buttonClasses('gold')}>
        {status === 'uploading' ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}

/** Read-only URL field that selects itself on click, for quick copying. */
export function CopyableUrl({ url, label }: { url: string; label: string }) {
  return (
    <input
      readOnly
      value={url}
      aria-label={label}
      onFocus={(event) => event.currentTarget.select()}
      onClick={(event) => event.currentTarget.select()}
      className="mt-2 w-full truncate border border-ink-600 bg-ink-800 px-2 py-1 text-[10px] text-bone-dim"
    />
  );
}
