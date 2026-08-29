'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { saveArticleAction } from '@/app/actions/admin/content';
import { Field, Input, Textarea, Select, Checkbox, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';

export interface ArticleEditorValues {
  id?: string;
  title: string;
  slug: string;
  dek: string;
  excerpt: string;
  body: string;
  heroImageUrl: string;
  thumbnailUrl: string;
  seoTitle: string;
  seoDescription: string;
  categoryId: string;
  authorId: string;
  status: string;
  publishedAt: string;
  featured: boolean;
  breaking: boolean;
}

export function ArticleEditor({
  values,
  categories,
  authors,
  canPublish,
}: {
  values: ArticleEditorValues;
  categories: Array<{ id: string; name: string }>;
  authors: Array<{ id: string; name: string }>;
  canPublish: boolean;
}) {
  const [state, formAction] = useActionState(saveArticleAction, initialActionState);
  const router = useRouter();

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        router.refresh();
      }}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="space-y-5">
        <FormMessage state={state} />

        <Field label="Headline" name="title" error={fieldError(state, 'title')} required>
          <Input id="title" name="title" defaultValue={values.title} required />
        </Field>

        <Field
          label="Slug"
          name="slug"
          hint="Leave blank to generate from the headline. Changing this breaks existing links."
          error={fieldError(state, 'slug')}
        >
          <Input id="slug" name="slug" defaultValue={values.slug} placeholder="auto-generated" />
        </Field>

        <Field label="Standfirst" name="dek" error={fieldError(state, 'dek')}>
          <Textarea id="dek" name="dek" rows={2} maxLength={300} defaultValue={values.dek} />
        </Field>

        <Field
          label="Body"
          name="body"
          hint="HTML is allowed and sanitized on save — scripts and event handlers are stripped."
          error={fieldError(state, 'body')}
          required
        >
          <Textarea
            id="body"
            name="body"
            rows={22}
            defaultValue={values.body}
            required
            className="font-mono text-xs leading-relaxed"
          />
        </Field>

        <Field
          label="Excerpt"
          name="excerpt"
          hint="Used in cards and search results. Generated from the body if left blank."
          error={fieldError(state, 'excerpt')}
        >
          <Textarea
            id="excerpt"
            name="excerpt"
            rows={3}
            maxLength={400}
            defaultValue={values.excerpt}
          />
        </Field>
      </div>

      <aside className="space-y-5">
        <div className="panel space-y-4 p-5">
          <Field label="Status" name="status" required>
            <Select id="status" name="status" defaultValue={values.status} required>
              <option value="DRAFT">Draft</option>
              <option value="IN_REVIEW">In review</option>
              <option value="SCHEDULED">Scheduled</option>
              {canPublish ? <option value="PUBLISHED">Published</option> : null}
              <option value="ARCHIVED">Archived</option>
            </Select>
          </Field>

          {!canPublish ? (
            <p className="text-xs text-bone-dim">
              You can write and submit, but publishing requires the publish permission.
            </p>
          ) : null}

          <Field
            label="Publish date"
            name="publishedAt"
            hint="Set for scheduled stories. Defaults to now on publish."
            error={fieldError(state, 'publishedAt')}
          >
            <Input
              id="publishedAt"
              name="publishedAt"
              type="datetime-local"
              defaultValue={values.publishedAt}
            />
          </Field>

          <Checkbox name="featured" value="true" defaultChecked={values.featured} label="Featured" />
          <Checkbox name="breaking" value="true" defaultChecked={values.breaking} label="Breaking" />

          <SubmitButton className="w-full" pendingLabel="Saving…">
            Save story
          </SubmitButton>
        </div>

        <div className="panel space-y-4 p-5">
          <Field label="Category" name="categoryId">
            <Select id="categoryId" name="categoryId" defaultValue={values.categoryId}>
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Byline" name="authorId">
            <Select id="authorId" name="authorId" defaultValue={values.authorId}>
              <option value="">No byline</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="panel space-y-4 p-5">
          <Field label="Hero image URL" name="heroImageUrl" error={fieldError(state, 'heroImageUrl')}>
            <Input
              id="heroImageUrl"
              name="heroImageUrl"
              type="url"
              defaultValue={values.heroImageUrl}
            />
          </Field>

          <Field label="Thumbnail URL" name="thumbnailUrl" error={fieldError(state, 'thumbnailUrl')}>
            <Input
              id="thumbnailUrl"
              name="thumbnailUrl"
              type="url"
              defaultValue={values.thumbnailUrl}
            />
          </Field>
        </div>

        <div className="panel space-y-4 p-5">
          <Field label="SEO title" name="seoTitle" error={fieldError(state, 'seoTitle')}>
            <Input id="seoTitle" name="seoTitle" defaultValue={values.seoTitle} />
          </Field>

          <Field
            label="SEO description"
            name="seoDescription"
            error={fieldError(state, 'seoDescription')}
          >
            <Textarea
              id="seoDescription"
              name="seoDescription"
              rows={3}
              maxLength={300}
              defaultValue={values.seoDescription}
            />
          </Field>
        </div>
      </aside>
    </form>
  );
}
