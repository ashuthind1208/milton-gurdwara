import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import newsService from '../../services/newsService';
import { formatDate } from '../../utils/formatters';

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

const AdminNewsPage = () => {
  const queryClient = useQueryClient();
  const [editingArticle, setEditingArticle] = useState(null);

  const createForm = useForm({
    defaultValues: {
      heading: '',
      content: '',
      links: '',
      imageLinks: '',
      publishedAt: new Date().toISOString().slice(0, 10),
      expiryDate: '',
      active: true
    }
  });

  const editForm = useForm({
    defaultValues: {
      heading: '',
      content: '',
      links: '',
      imageLinks: '',
      publishedAt: new Date().toISOString().slice(0, 10),
      expiryDate: '',
      active: true
    }
  });

  const { data: articles = [] } = useQuery({
    queryKey: ['news-articles'],
    queryFn: () => newsService.getArticles().then((res) => res.data)
  });

  const createMutation = useMutation({
    mutationFn: (values) => newsService.createArticle(normalizeFormValues(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-articles'] });
      createForm.reset({
        heading: '',
        content: '',
        links: '',
        imageLinks: '',
        publishedAt: new Date().toISOString().slice(0, 10),
        expiryDate: '',
        active: true
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => newsService.updateArticle(id, normalizeFormValues(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-articles'] });
      setEditingArticle(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => newsService.removeArticle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-articles'] });
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

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">News and Updates</h1>

      <Card>
        <h2 className="font-heading text-xl font-semibold">Create News Article</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
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
            <textarea rows={3} {...createForm.register('links')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://example.com/post\nhttps://example.com/register" />
          </label>

          <label className="text-sm md:col-span-2">Image Links (one per line or comma-separated)
            <textarea rows={3} {...createForm.register('imageLinks')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://example.com/image.jpg" />
          </label>

          <label className="text-sm md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <input type="checkbox" {...createForm.register('active')} />
            <span>Active</span>
          </label>

          <div className="md:col-span-2">
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Create Article'}</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {articles.map((article) => (
          <Card key={article.id} className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl space-y-1">
              <p className="font-semibold text-slate-800">{article.heading}</p>
              <p className="text-sm text-slate-600">Published: {formatDate(article.publishedAt)}{article.expiryDate ? ` • Expires: ${formatDate(article.expiryDate)}` : ''}</p>
              <p className="text-xs text-slate-500">Status: {article.active ? 'Active' : 'Inactive'} • Links: {(article.links || []).length} • Images: {(article.imageLinks || []).length}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openEdit(article)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">Edit</button>
              <button type="button" onClick={() => deleteMutation.mutate(article.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Delete</button>
            </div>
          </Card>
        ))}
      </div>

      {editingArticle ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit News Article</h3>
              <button type="button" onClick={() => setEditingArticle(null)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>

            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingArticle.id, values }))}>
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
              </label>

              <label className="text-sm md:col-span-2">Image Links (one per line or comma-separated)
                <textarea rows={3} {...editForm.register('imageLinks')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>

              <label className="text-sm md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <input type="checkbox" {...editForm.register('active')} />
                <span>Active</span>
              </label>

              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <button type="button" onClick={() => setEditingArticle(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminNewsPage;
