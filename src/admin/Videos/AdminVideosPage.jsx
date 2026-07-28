import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PencilSquareIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import videoService, { CATEGORIES, getYouTubeEmbedUrl, getYouTubeThumbnail } from '../../services/videoService';

const PAGE_SIZE = 10;
const actionIconClass = 'h-4 w-4';

const emptyForm = {
  title: '',
  description: '',
  videoUrl: '',
  platform: 'youtube',
  category: 'General',
  thumbnailUrl: '',
  featuredDate: new Date().toISOString().slice(0, 10),
  featured: false,
  tags: ''
};

const Pagination = ({ page, total, onChange }) => {
  if (total <= 1) { return null; }
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
      <span className="text-xs font-semibold text-slate-600">Page {page} of {total}</span>
      <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={page >= total} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
};

const platformBadge = { youtube: 'bg-red-50 text-red-700 border-red-200', facebook: 'bg-blue-50 text-blue-700 border-blue-200', other: 'bg-slate-50 text-slate-600 border-slate-200' };

const AdminVideosPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [videoModal, setVideoModal] = useState({ open: false, mode: 'add', id: '' });
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const form = useForm({ defaultValues: emptyForm });

  const { data: videos = [] } = useQuery({
    queryKey: ['gurdwara-videos'],
    queryFn: () => videoService.getVideos().then((res) => res.data)
  });

  const filteredVideos = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    return videos.filter((video) => {
      const platformOk = platformFilter === 'all' ? true : String(video?.platform || '').toLowerCase() === platformFilter;
      const categoryOk = categoryFilter === 'all' ? true : String(video?.category || '') === categoryFilter;

      if (!platformOk || !categoryOk) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [video?.title, video?.description, video?.tags, video?.videoUrl]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });
  }, [categoryFilter, platformFilter, searchTerm, videos]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));
  const visibleVideos = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredVideos.slice(start, start + PAGE_SIZE);
  }, [filteredVideos, page]);

  const categoryOptions = useMemo(() => {
    const categories = videos
      .map((video) => String(video?.category || '').trim())
      .filter(Boolean);
    return [...new Set(categories)].sort((a, b) => a.localeCompare(b));
  }, [videos]);

  const selectedVideo = useMemo(
    () => videos.find((v) => v.id === videoModal.id) || null,
    [videoModal.id, videos]
  );

  useEffect(() => {
    if (!videoModal.open) { return; }
    if (videoModal.mode === 'add') { form.reset(emptyForm); return; }
    if (selectedVideo) {
      form.reset({
        title: selectedVideo.title || '',
        description: selectedVideo.description || '',
        videoUrl: selectedVideo.videoUrl || '',
        platform: selectedVideo.platform || 'youtube',
        category: selectedVideo.category || 'General',
        thumbnailUrl: selectedVideo.thumbnailUrl || '',
        featuredDate: selectedVideo.featuredDate || new Date().toISOString().slice(0, 10),
        featured: selectedVideo.featured || false,
        tags: selectedVideo.tags || ''
      });
    }
  }, [form, selectedVideo, videoModal]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, platformFilter, categoryFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['gurdwara-videos'] });

  const addMutation = useMutation({
    mutationFn: (values) => videoService.addVideo(values),
    onSuccess: () => { invalidate(); setVideoModal({ open: false, mode: 'add', id: '' }); form.reset(emptyForm); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => videoService.updateVideo(id, values),
    onSuccess: () => { invalidate(); setVideoModal({ open: false, mode: 'add', id: '' }); form.reset(emptyForm); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => videoService.removeVideo(id),
    onSuccess: () => invalidate()
  });

  const isSaving = addMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    setHeaderAction(
      <AdminHeaderActionButton label="Add Video" onClick={() => setVideoModal({ open: true, mode: 'add', id: '' })} />
    );

    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Gurdwara Videos</h1>
      <p className="text-sm text-slate-600">Add YouTube and Facebook video links from the Gurdwara channel and Facebook page. YouTube videos embed directly; Facebook links open in a new tab.</p>

      <Card>
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
            Search
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search title, tags, or URL"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Platform
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="all">All</option>
              <option value="youtube">YouTube</option>
              <option value="facebook">Facebook</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="all">All</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-1.5">Video</th>
                <th className="px-3 py-1.5">Platform</th>
                <th className="px-3 py-1.5">Category</th>
                <th className="px-3 py-1.5">Date</th>
                <th className="px-3 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleVideos.map((video) => {
                const thumb = video.thumbnailUrl || (video.platform === 'youtube' ? getYouTubeThumbnail(video.videoUrl) : '');
                return (
                  <tr key={video.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {thumb ? (
                          <img src={thumb} alt={video.title} className="h-9 w-16 rounded object-cover" />
                        ) : (
                          <div className="h-9 w-16 rounded bg-slate-200" />
                        )}
                        <div>
                          <p className="font-semibold text-slate-800">{video.title || 'Untitled'}</p>
                          <p className="text-xs text-slate-500">{video.tags || 'No tags'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${platformBadge[video.platform] || platformBadge.other}`}>{video.platform}</span>
                    </td>
                    <td className="px-3 py-1.5">{video.category}</td>
                    <td className="px-3 py-1.5">{video.featuredDate || '-'}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100" title="View" onClick={() => setVideoModal({ open: true, mode: 'view', id: video.id })}><EyeIcon className={actionIconClass} /></button>
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded border border-blue-200 text-blue-700 hover:bg-blue-50" title="Edit" onClick={() => setVideoModal({ open: true, mode: 'edit', id: video.id })}><PencilSquareIcon className={actionIconClass} /></button>
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-700 hover:bg-red-50" title="Delete" onClick={() => deleteMutation.mutate(video.id)}><TrashIcon className={actionIconClass} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredVideos.length === 0 ? (
                <tr><td className="px-3 py-4 text-center text-slate-500" colSpan={5}>No videos added yet. Click Add Video to get started.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filteredVideos.length > 0 ? (
          <p className="mt-3 text-xs text-slate-600">Showing {visibleVideos.length} of {filteredVideos.length} videos</p>
        ) : null}
        <Pagination page={page} total={totalPages} onChange={setPage} />
      </Card>

      {videoModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" aria-hidden="true" onClick={() => setVideoModal({ open: false, mode: 'add', id: '' })} />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold">
                {videoModal.mode === 'add' ? 'Add Video' : videoModal.mode === 'edit' ? 'Edit Video' : 'Video Details'}
              </h3>
              <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" onClick={() => setVideoModal({ open: false, mode: 'add', id: '' })}><XMarkIcon className="h-5 w-5" /></button>
            </div>

            {videoModal.mode === 'view' && selectedVideo ? (
              <div className="mt-4 space-y-3">
                {selectedVideo.platform === 'youtube' && getYouTubeEmbedUrl(selectedVideo.videoUrl) ? (
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
                    <iframe className="h-full w-full" src={getYouTubeEmbedUrl(selectedVideo.videoUrl)} title={selectedVideo.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <a href={selectedVideo.videoUrl} target="_blank" rel="noreferrer" className="block rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Watch on {selectedVideo.platform === 'facebook' ? 'Facebook' : 'External Link'} →</a>
                )}
                <div className="grid gap-1.5 text-sm text-slate-700 md:grid-cols-2">
                  <p><span className="font-semibold">Title:</span> {selectedVideo.title}</p>
                  <p><span className="font-semibold">Category:</span> {selectedVideo.category}</p>
                  <p><span className="font-semibold">Date:</span> {selectedVideo.featuredDate}</p>
                  <p><span className="font-semibold">Platform:</span> {selectedVideo.platform}</p>
                  {selectedVideo.tags ? <p className="md:col-span-2"><span className="font-semibold">Tags:</span> {selectedVideo.tags}</p> : null}
                  {selectedVideo.description ? <p className="md:col-span-2"><span className="font-semibold">Description:</span> {selectedVideo.description}</p> : null}
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" onClick={() => setVideoModal({ open: false, mode: 'add', id: '' })}>Close</Button>
                </div>
              </div>
            ) : (
              <form
                className="mt-4 grid gap-2.5 md:grid-cols-2"
                onSubmit={form.handleSubmit((values) => {
                  if (videoModal.mode === 'edit' && videoModal.id) {
                    updateMutation.mutate({ id: videoModal.id, values });
                    return;
                  }
                  addMutation.mutate(values);
                })}
              >
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Video URL (YouTube or Facebook)
                  <input {...form.register('videoUrl', { required: true })} placeholder="https://www.youtube.com/watch?v=... or Facebook link" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                  <p className="mt-0.5 text-[11px] text-slate-500">YouTube: auto-embeds on site. Facebook: shows Watch button (Facebook restricts cross-site embeds).</p>
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Title
                  <input {...form.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Category
                  <select {...form.register('category')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Date
                  <input type="date" {...form.register('featuredDate')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Thumbnail Image URL (optional override)
                  <input {...form.register('thumbnailUrl')} placeholder="Leave blank to use YouTube auto-thumbnail" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Tags
                  <input {...form.register('tags')} placeholder="kirtan, samagam, youth" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Description
                  <textarea rows={2} {...form.register('description')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" {...form.register('featured')} className="h-4 w-4 rounded border-slate-300" />
                  Pin this as a featured video
                </label>
                <div className="md:col-span-2 flex gap-2">
                  <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : (videoModal.mode === 'edit' ? 'Update Video' : 'Add Video')}</Button>
                  <Button type="button" variant="ghost" onClick={() => setVideoModal({ open: false, mode: 'add', id: '' })}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminVideosPage;
