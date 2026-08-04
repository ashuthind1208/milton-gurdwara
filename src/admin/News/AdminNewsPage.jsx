import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import newsService from '../../services/newsService';
import { formatDate } from '../../utils/formatters';
import uploadService from '../../services/uploadService';
import StatusAlert from '../../components/common/StatusAlert';
import RichTextEditor from '../../components/forms/RichTextEditor';

const actionIconClass = 'h-4 w-4';

const defaultFormValues = {
  heading: '',
  content: '',
  links: '',
  imageLinks: '',
  publishedAt: new Date().toISOString().slice(0, 10),
  expiryDate: '',
  active: true
};

const listToTextarea = (values = []) => (values || []).join('\n');
const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const truncateText = (value, maxLength = 60) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
};

const normalizeFormValues = (values) => ({
  heading: values.heading,
  content: values.content,
  links: values.links,
  imageLinks: values.imageLinks,
  publishedAt: values.publishedAt,
  expiryDate: values.expiryDate,
  active: Boolean(values.active)
});

const appendUrlLine = (existingValue, nextUrl) => {
  const current = String(existingValue || '').trim();
  if (!current) {
    return nextUrl;
  }
  return `${current}\n${nextUrl}`;
};

const AdminNewsPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewArticle, setViewArticle] = useState(null);
  const [editingArticle, setEditingArticle] = useState(null);
  const [createUploadState, setCreateUploadState] = useState('');
  const [editUploadState, setEditUploadState] = useState('');
  const [createUploadProgress, setCreateUploadProgress] = useState({ links: 0, imageLinks: 0 });
  const [editUploadProgress, setEditUploadProgress] = useState({ links: 0, imageLinks: 0 });
  const [createContentHtml, setCreateContentHtml] = useState('');
  const [editContentHtml, setEditContentHtml] = useState('');
  const [uploadStatus, setUploadStatus] = useState({ type: 'success', message: '' });

  const createForm = useForm({ defaultValues: defaultFormValues });
  const editForm = useForm({ defaultValues: defaultFormValues });

  const { data: articles = [] } = useQuery({
    queryKey: ['news-articles'],
    queryFn: () => newsService.getArticles().then((res) => res.data)
  });

  const createMutation = useMutation({
    mutationFn: (values) => newsService.createArticle(normalizeFormValues({ ...values, content: createContentHtml })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-articles'] });
      createForm.reset(defaultFormValues);
      setCreateContentHtml('');
      setCreateOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => newsService.updateArticle(id, normalizeFormValues({ ...values, content: editContentHtml })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-articles'] });
      setEditingArticle(null);
      setEditContentHtml('');
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => newsService.updateArticle(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['news-articles'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => newsService.removeArticle(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['news-articles'] });
      setViewArticle((prev) => (prev?.id ? (prev.id === id ? null : prev) : prev));
    }
  });

  const openEdit = (article) => {
    setEditingArticle(article);
    editForm.reset({
      heading: article.heading || '',
      content: article.content || '',
      links: listToTextarea(article.links),
      imageLinks: listToTextarea(article.imageLinks),
      publishedAt: article.publishedAt || new Date().toISOString().slice(0, 10),
      expiryDate: article.expiryDate || '',
      active: typeof article.active === 'boolean' ? article.active : true
    });
    setEditContentHtml(String(article.content || ''));
  };

  const closeModals = () => {
    setCreateOpen(false);
    setViewArticle(null);
    setEditingArticle(null);
    setCreateContentHtml('');
    setEditContentHtml('');
  };

  const uploadNewsFile = async ({ file, mode, targetField }) => {
    if (!file) {
      return;
    }

    try {
      if (mode === 'create') {
        setCreateUploadState(targetField);
        setCreateUploadProgress((prev) => ({ ...prev, [targetField]: 0 }));
      } else {
        setEditUploadState(targetField);
        setEditUploadProgress((prev) => ({ ...prev, [targetField]: 0 }));
      }

      const uploaded = await uploadService.uploadFile({
        service: 'news',
        file,
        allowedMimeTypes: targetField === 'imageLinks'
          ? ['image/*']
          : ['image/*', 'video/*', 'application/pdf', 'text/plain'],
        maxSizeMB: 15,
        onProgress: (percent) => {
          if (mode === 'create') {
            setCreateUploadProgress((prev) => ({ ...prev, [targetField]: percent }));
            return;
          }

          setEditUploadProgress((prev) => ({ ...prev, [targetField]: percent }));
        }
      });
      const nextUrl = uploaded?.url || '';
      if (!nextUrl) {
        throw new Error('Upload did not return a file URL.');
      }

      if (mode === 'create') {
        const existing = createForm.getValues(targetField) || '';
        createForm.setValue(targetField, appendUrlLine(existing, nextUrl), { shouldDirty: true, shouldValidate: true });
      } else {
        const existing = editForm.getValues(targetField) || '';
        editForm.setValue(targetField, appendUrlLine(existing, nextUrl), { shouldDirty: true, shouldValidate: true });
      }
      setUploadStatus({ type: 'success', message: 'File uploaded successfully.' });
    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message || 'Unable to upload file.' });
    } finally {
      if (mode === 'create') {
        setCreateUploadState('');
        setCreateUploadProgress((prev) => ({ ...prev, [targetField]: 0 }));
      } else {
        setEditUploadState('');
        setEditUploadProgress((prev) => ({ ...prev, [targetField]: 0 }));
      }
    }
  };

  useEffect(() => {
    setHeaderAction(<AdminHeaderActionButton label="Add News" onClick={() => setCreateOpen(true)} />);

    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  useEffect(() => {
    if (!createOpen) {
      return;
    }
    setCreateContentHtml(String(createForm.getValues('content') || ''));
  }, [createForm, createOpen]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">News and Updates</h1>

      <Card>
        <div className="space-y-3 md:hidden">
          {articles.map((article) => (
            <article key={`mobile-${article.id}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{article.heading || 'Untitled'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{truncateText(stripHtml(article.content), 60) || '-'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActiveMutation.mutate({ id: article.id, active: !article.active })}
                  className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${article.active ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-slate-300 bg-slate-100 text-slate-700'}`}
                  title={article.active ? 'Set inactive' : 'Set active'}
                  aria-label={article.active ? 'Set inactive' : 'Set active'}
                >
                  {article.active ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span>Published: {formatDate(article.publishedAt)}</span>
                <span>Expiry: {article.expiryDate ? formatDate(article.expiryDate) : '-'}</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewArticle(article)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700"
                  title="View"
                  aria-label="View"
                >
                  <EyeIcon className={actionIconClass} />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(article)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 text-blue-700"
                  title="Edit"
                  aria-label="Edit"
                >
                  <PencilSquareIcon className={actionIconClass} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(article.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700"
                  title="Delete"
                  aria-label="Delete"
                >
                  <TrashIcon className={actionIconClass} />
                </button>
              </div>
            </article>
          ))}

          {articles.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No news records found.</div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Heading</th>
                <th className="py-2 pr-3">Published</th>
                <th className="py-2 pr-3">Expiry</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-slate-800">{article.heading || 'Untitled'}</p>
                    <p className="text-xs text-slate-500">{truncateText(stripHtml(article.content), 60) || '-'}</p>
                  </td>
                  <td className="py-2 pr-3">{formatDate(article.publishedAt)}</td>
                  <td className="py-2 pr-3">{article.expiryDate ? formatDate(article.expiryDate) : '-'}</td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleActiveMutation.mutate({ id: article.id, active: !article.active })}
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold transition ${article.active ? 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-200/70' : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-200/70'}`}
                      title={article.active ? 'Set inactive' : 'Set active'}
                      aria-label={article.active ? 'Set inactive' : 'Set active'}
                    >
                      {article.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewArticle(article)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                        title="View"
                        aria-label="View"
                      >
                        <EyeIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(article)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <PencilSquareIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(article.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <TrashIcon className={actionIconClass} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {articles.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={5}>No news records found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {createOpen ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-2 py-3 sm:px-4 sm:py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-4xl max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-[0_24px_56px_-42px_rgba(15,23,42,0.75)] sm:max-h-[calc(100vh-3rem)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-brand-blue via-sky-600 to-brand-saffron px-3 py-3 text-white sm:px-5 sm:py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">News Workspace</p>
                <h3 className="mt-1 truncate font-heading text-lg font-bold sm:text-2xl">Add Article</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px]">Publish: {formatDate(createForm.getValues('publishedAt'))}</span>
                  <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px]">Expiry: {createForm.getValues('expiryDate') ? formatDate(createForm.getValues('expiryDate')) : '-'}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] ${createForm.watch('active') ? 'border-emerald-200/90 bg-emerald-500/25 text-emerald-50' : 'border-slate-200/80 bg-slate-500/25 text-slate-100'}`}>
                    {createForm.watch('active') ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <button type="button" onClick={closeModals} className="rounded-md border border-white/30 bg-white/10 px-2.5 py-1 text-sm">Close</button>
            </div>
            <form className="grid gap-3 px-3 py-3 sm:px-5 sm:py-4 md:grid-cols-2" onSubmit={createForm.handleSubmit((values) => {
              const contentPlain = stripHtml(createContentHtml);
              if (!contentPlain) {
                setUploadStatus({ type: 'error', message: 'Content is required.' });
                return;
              }
              createMutation.mutate({ ...values, content: createContentHtml });
            })}>
              <div className="md:col-span-2">
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              </div>
              <label className="text-sm md:col-span-2">Heading
                <input {...createForm.register('heading', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Content
                <div className="mt-1">
                  <RichTextEditor value={createContentHtml} onChange={setCreateContentHtml} minHeight={180} />
                </div>
              </label>
              <label className="text-sm">Publishing Date
                <input type="date" {...createForm.register('publishedAt', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Expiry Date
                <input type="date" {...createForm.register('expiryDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Image Links (one per line or comma-separated)
                <textarea rows={3} {...createForm.register('imageLinks')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-xs"
                  onChange={(event) => uploadNewsFile({ file: event.target.files?.[0], mode: 'create', targetField: 'imageLinks' })}
                />
                <p className="mt-1 text-xs text-slate-500">{createUploadState === 'imageLinks' ? `Uploading image... ${createUploadProgress.imageLinks}%` : 'Upload an image to append its URL here (max 15MB), or paste image URLs manually.'}</p>
                {createUploadState === 'imageLinks' ? (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-brand-blue transition-all" style={{ width: `${createUploadProgress.imageLinks}%` }} />
                  </div>
                ) : null}
              </label>
              <label className="text-sm md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <input type="checkbox" {...createForm.register('active')} />
                <span>Active</span>
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Create News'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}

      {viewArticle ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-2 py-3 sm:px-4 sm:py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-4xl max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-[0_24px_56px_-42px_rgba(15,23,42,0.75)] sm:max-h-[calc(100vh-3rem)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-brand-blue via-blue-600 to-brand-saffron px-3 py-3 text-white sm:px-5 sm:py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">News Center</p>
                <h3 className="mt-1 truncate font-heading text-lg font-bold sm:text-2xl">{viewArticle.heading || 'News Details'}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px]">Published: {formatDate(viewArticle.publishedAt)}</span>
                  <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px]">Expiry: {viewArticle.expiryDate ? formatDate(viewArticle.expiryDate) : '-'}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] ${viewArticle.active ? 'border-emerald-200/90 bg-emerald-500/25 text-emerald-50' : 'border-slate-200/80 bg-slate-500/25 text-slate-100'}`}>
                    {viewArticle.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <button type="button" onClick={closeModals} className="rounded-md border border-white/30 bg-white/10 px-2.5 py-1 text-sm">Close</button>
            </div>
            <div className="space-y-4 px-3 py-3 text-sm text-slate-700 sm:px-5 sm:py-4">
              <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Content</p>
                {stripHtml(viewArticle.content) ? (
                  <div className="prose prose-sm max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: String(viewArticle.content || '') }} />
                ) : (
                  <p>-</p>
                )}
              </section>

              {(viewArticle.imageLinks || []).length > 0 ? (
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Images</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(viewArticle.imageLinks || []).map((entry) => (
                      <img key={entry} src={entry} alt={viewArticle.heading || 'News image'} className="h-44 w-full rounded-lg border border-slate-200 object-cover" loading="lazy" />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {editingArticle ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-2 py-3 sm:px-4 sm:py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-4xl max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-[0_24px_56px_-42px_rgba(15,23,42,0.75)] sm:max-h-[calc(100vh-3rem)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-600 via-brand-blue to-indigo-700 px-3 py-3 text-white sm:px-5 sm:py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">News Workspace</p>
                <h3 className="mt-1 truncate font-heading text-lg font-bold sm:text-2xl">Edit Article</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px]">Published: {formatDate(editForm.getValues('publishedAt'))}</span>
                  <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px]">Expiry: {editForm.getValues('expiryDate') ? formatDate(editForm.getValues('expiryDate')) : '-'}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] ${editForm.watch('active') ? 'border-emerald-200/90 bg-emerald-500/25 text-emerald-50' : 'border-slate-200/80 bg-slate-500/25 text-slate-100'}`}>
                    {editForm.watch('active') ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <button type="button" onClick={closeModals} className="rounded-md border border-white/30 bg-white/10 px-2.5 py-1 text-sm">Close</button>
            </div>
            <form className="grid gap-3 px-3 py-3 sm:px-5 sm:py-4 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => {
              const contentPlain = stripHtml(editContentHtml);
              if (!contentPlain) {
                setUploadStatus({ type: 'error', message: 'Content is required.' });
                return;
              }
              updateMutation.mutate({ id: editingArticle.id, values: { ...values, content: editContentHtml } });
            })}>
              <div className="md:col-span-2">
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              </div>
              <label className="text-sm md:col-span-2">Heading
                <input {...editForm.register('heading', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Content
                <div className="mt-1">
                  <RichTextEditor value={editContentHtml} onChange={setEditContentHtml} minHeight={180} />
                </div>
              </label>
              <label className="text-sm">Publishing Date
                <input type="date" {...editForm.register('publishedAt', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Expiry Date
                <input type="date" {...editForm.register('expiryDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Image Links (one per line or comma-separated)
                <textarea rows={3} {...editForm.register('imageLinks')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-xs"
                  onChange={(event) => uploadNewsFile({ file: event.target.files?.[0], mode: 'edit', targetField: 'imageLinks' })}
                />
                <p className="mt-1 text-xs text-slate-500">{editUploadState === 'imageLinks' ? `Uploading image... ${editUploadProgress.imageLinks}%` : 'Upload an image to append its URL here (max 15MB), or paste image URLs manually.'}</p>
                {editUploadState === 'imageLinks' ? (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-brand-blue transition-all" style={{ width: `${editUploadProgress.imageLinks}%` }} />
                  </div>
                ) : null}
              </label>
              <label className="text-sm md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <input type="checkbox" {...editForm.register('active')} />
                <span>Active</span>
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}

      {(createOpen || viewArticle || editingArticle) ? (
        <button
          type="button"
          onClick={closeModals}
          className="fixed right-5 top-5 z-[96] inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow"
          aria-label="Close popup"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
};

export default AdminNewsPage;
