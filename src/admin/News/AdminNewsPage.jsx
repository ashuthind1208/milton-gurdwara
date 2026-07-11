import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import newsService from '../../services/newsService';
import { formatDate } from '../../utils/formatters';
import uploadService from '../../services/uploadService';
import StatusAlert from '../../components/common/StatusAlert';

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
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewArticle, setViewArticle] = useState(null);
  const [editingArticle, setEditingArticle] = useState(null);
  const [createUploadState, setCreateUploadState] = useState('');
  const [editUploadState, setEditUploadState] = useState('');
  const [createUploadProgress, setCreateUploadProgress] = useState({ links: 0, imageLinks: 0 });
  const [editUploadProgress, setEditUploadProgress] = useState({ links: 0, imageLinks: 0 });
  const [uploadStatus, setUploadStatus] = useState({ type: 'success', message: '' });

  const createForm = useForm({ defaultValues: defaultFormValues });
  const editForm = useForm({ defaultValues: defaultFormValues });

  const { data: articles = [] } = useQuery({
    queryKey: ['news-articles'],
    queryFn: () => newsService.getArticles().then((res) => res.data)
  });

  const createMutation = useMutation({
    mutationFn: (values) => newsService.createArticle(normalizeFormValues(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-articles'] });
      createForm.reset(defaultFormValues);
      setCreateOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => newsService.updateArticle(id, normalizeFormValues(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-articles'] });
      setEditingArticle(null);
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
  };

  const closeModals = () => {
    setCreateOpen(false);
    setViewArticle(null);
    setEditingArticle(null);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold">News and Updates</h1>
        <Button type="button" onClick={() => setCreateOpen(true)}>Add New News</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
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
                    <p className="text-xs text-slate-500 line-clamp-1">{article.content || '-'}</p>
                  </td>
                  <td className="py-2 pr-3">{formatDate(article.publishedAt)}</td>
                  <td className="py-2 pr-3">{article.expiryDate ? formatDate(article.expiryDate) : '-'}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${article.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {article.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActiveMutation.mutate({ id: article.id, active: !article.active })}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${article.active ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                        title={article.active ? 'Mark inactive' : 'Mark active'}
                        aria-label={article.active ? 'Mark inactive' : 'Mark active'}
                      >
                        <CheckIcon className={actionIconClass} />
                      </button>
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
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Add News</h3>
              <button type="button" onClick={closeModals} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
              <div className="md:col-span-2">
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              </div>
              <label className="text-sm md:col-span-2">Heading
                <input {...createForm.register('heading', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Content
                <textarea rows={4} {...createForm.register('content', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Publishing Date
                <input type="date" {...createForm.register('publishedAt', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Expiry Date
                <input type="date" {...createForm.register('expiryDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Links (one per line or comma-separated)
                <textarea rows={3} {...createForm.register('links')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf,text/plain"
                  className="mt-2 block w-full text-xs"
                  onChange={(event) => uploadNewsFile({ file: event.target.files?.[0], mode: 'create', targetField: 'links' })}
                />
                <p className="mt-1 text-xs text-slate-500">{createUploadState === 'links' ? `Uploading file... ${createUploadProgress.links}%` : 'Upload a file to append its URL here (image/video/pdf/txt, max 15MB), or paste links manually.'}</p>
                {createUploadState === 'links' ? (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-brand-blue transition-all" style={{ width: `${createUploadProgress.links}%` }} />
                  </div>
                ) : null}
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
      ) : null}

      {viewArticle ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">News Details</h3>
              <button type="button" onClick={closeModals} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold">Heading:</span> {viewArticle.heading || '-'}</p>
              <p><span className="font-semibold">Published:</span> {formatDate(viewArticle.publishedAt)}</p>
              <p><span className="font-semibold">Expiry:</span> {viewArticle.expiryDate ? formatDate(viewArticle.expiryDate) : '-'}</p>
              <p><span className="font-semibold">Status:</span> {viewArticle.active ? 'Active' : 'Inactive'}</p>
              <p className="whitespace-pre-wrap"><span className="font-semibold">Content:</span> {viewArticle.content || '-'}</p>
              <div>
                <p className="font-semibold">Links:</p>
                {(viewArticle.links || []).length === 0 ? <p>-</p> : (
                  <ul className="list-disc pl-5">
                    {(viewArticle.links || []).map((entry) => <li key={entry}><a href={entry} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">{entry}</a></li>)}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingArticle ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit News</h3>
              <button type="button" onClick={closeModals} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingArticle.id, values }))}>
              <div className="md:col-span-2">
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              </div>
              <label className="text-sm md:col-span-2">Heading
                <input {...editForm.register('heading', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Content
                <textarea rows={4} {...editForm.register('content', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Publishing Date
                <input type="date" {...editForm.register('publishedAt', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Expiry Date
                <input type="date" {...editForm.register('expiryDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Links (one per line or comma-separated)
                <textarea rows={3} {...editForm.register('links')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf,text/plain"
                  className="mt-2 block w-full text-xs"
                  onChange={(event) => uploadNewsFile({ file: event.target.files?.[0], mode: 'edit', targetField: 'links' })}
                />
                <p className="mt-1 text-xs text-slate-500">{editUploadState === 'links' ? `Uploading file... ${editUploadProgress.links}%` : 'Upload a file to append its URL here (image/video/pdf/txt, max 15MB), or paste links manually.'}</p>
                {editUploadState === 'links' ? (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-brand-blue transition-all" style={{ width: `${editUploadProgress.links}%` }} />
                  </div>
                ) : null}
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
