import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import galleryService from '../../services/galleryService';
import uploadService from '../../services/uploadService';

const AdminGalleryPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [coverUpload, setCoverUpload] = useState({ mode: '', errorMode: '', progress: 0, error: '' });

  const createForm = useForm({
    defaultValues: {
      title: '',
      description: '',
      eventDate: '',
      frontImage: '',
      googleDriveFolderUrl: '',
      dropboxFolderUrl: '',
      isActive: true
    }
  });
  const editForm = useForm({
    defaultValues: {
      title: '',
      description: '',
      eventDate: '',
      frontImage: '',
      googleDriveFolderUrl: '',
      dropboxFolderUrl: '',
      isActive: true
    }
  });

  const { data: albums = [] } = useQuery({
    queryKey: ['gallery'],
    queryFn: () => galleryService.getAlbums().then((res) => res.data)
  });

  const orderedAlbums = useMemo(
    () => [...albums].sort((a, b) => String(b.eventDate || '').localeCompare(String(a.eventDate || ''))),
    [albums]
  );

  const createMutation = useMutation({
    mutationFn: (values) => galleryService.createAlbum(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      createForm.reset({ title: '', description: '', eventDate: '', frontImage: '', googleDriveFolderUrl: '', dropboxFolderUrl: '', isActive: true });
      setIsCreateOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => galleryService.updateAlbum(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      setEditingAlbum(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => galleryService.removeAlbum(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gallery'] })
  });

  const openEdit = (album) => {
    setEditingAlbum(album);
    editForm.reset({
      title: album.title,
      description: album.description || '',
      eventDate: album.eventDate || '',
      frontImage: album.frontImage || '',
      googleDriveFolderUrl: album.googleDriveFolderUrl || '',
      dropboxFolderUrl: album.dropboxFolderUrl || '',
      isActive: Boolean(album.isActive)
    });
  };

  const uploadFrontImage = async ({ file, mode }) => {
    if (!file) {
      return;
    }

    setCoverUpload({ mode, errorMode: '', progress: 0, error: '' });
    try {
      const uploaded = await uploadService.uploadFile({
        service: 'gallery',
        file,
        allowedMimeTypes: ['image/*'],
        maxSizeMB: 15,
        onProgress: (progress) => setCoverUpload({ mode, errorMode: '', progress, error: '' })
      });
      const url = String(uploaded?.url || '').trim();
      if (!url) {
        throw new Error('Upload did not return an image URL.');
      }

      const targetForm = mode === 'create' ? createForm : editForm;
      targetForm.setValue('frontImage', url, { shouldDirty: true, shouldValidate: true });
      setCoverUpload({ mode: '', errorMode: '', progress: 0, error: '' });
    } catch (error) {
      setCoverUpload({ mode: '', errorMode: mode, progress: 0, error: error.message || 'Unable to upload the front image.' });
    }
  };

  useEffect(() => {
    setHeaderAction(
      <AdminHeaderActionButton label="Add Gallery Item" onClick={() => setIsCreateOpen(true)} />
    );

    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Gallery Folders</h1>

      <div className="space-y-3">
        {orderedAlbums.map((album) => (
          <Card key={album.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">{album.title}</p>
              <p className="text-sm text-slate-600">{album.eventDate || 'No date'} • {album.isActive ? 'Active' : 'Inactive'} • {(album.folderSources || []).length > 0 ? `${album.folderSources.length} source link(s)` : 'No folder linked'}</p>
              {album.description ? <p className="mt-1 truncate text-xs text-slate-500">{album.description}</p> : null}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => window.open(album.folderUrl || '#', '_blank', 'noopener,noreferrer')} disabled={!album.folderUrl} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">View</button>
              <button type="button" onClick={() => openEdit(album)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">Edit</button>
              <button type="button" onClick={() => deleteMutation.mutate(album.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Delete</button>
            </div>
          </Card>
        ))}
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Add Gallery Item</h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
              <label className="text-sm">Title
                <input {...createForm.register('title', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Date
                <input type="date" {...createForm.register('eventDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Description
                <textarea {...createForm.register('description')} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Front Image URL
                <input {...createForm.register('frontImage')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://..." />
                <input type="file" accept="image/*" className="mt-2 block w-full text-xs" onChange={(event) => uploadFrontImage({ file: event.target.files?.[0], mode: 'create' })} />
                <p className="mt-1 text-xs text-slate-500">{coverUpload.mode === 'create' ? `Uploading image... ${coverUpload.progress}%` : 'Paste a URL or upload an image from this device (max 15MB).'}</p>
                {coverUpload.mode === 'create' ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-blue transition-all" style={{ width: `${coverUpload.progress}%` }} /></div> : null}
                {coverUpload.errorMode === 'create' ? <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{coverUpload.error}</p> : null}
              </label>
              <label className="text-sm">Google Drive Folder URL
                <input {...createForm.register('googleDriveFolderUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://drive.google.com/drive/folders/..." />
              </label>
              <label className="text-sm">Dropbox Folder URL
                <input {...createForm.register('dropboxFolderUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://www.dropbox.com/..." />
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" {...createForm.register('isActive')} />
                Active
              </label>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={createMutation.isPending || coverUpload.mode === 'create'}>{createMutation.isPending ? 'Creating...' : 'Create Folder'}</Button>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}

      {editingAlbum ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Folder</h3>
              <button type="button" onClick={() => setEditingAlbum(null)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>

            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingAlbum.id, values }))}>
                <label className="text-sm">Title
                  <input {...editForm.register('title', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm">Date
                  <input type="date" {...editForm.register('eventDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm md:col-span-2">Description
                  <textarea {...editForm.register('description')} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm md:col-span-2">Front Image URL
                  <input {...editForm.register('frontImage')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://..." />
                  <input type="file" accept="image/*" className="mt-2 block w-full text-xs" onChange={(event) => uploadFrontImage({ file: event.target.files?.[0], mode: 'edit' })} />
                  <p className="mt-1 text-xs text-slate-500">{coverUpload.mode === 'edit' ? `Uploading image... ${coverUpload.progress}%` : 'Paste a URL or upload an image from this device (max 15MB).'}</p>
                  {coverUpload.mode === 'edit' ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-blue transition-all" style={{ width: `${coverUpload.progress}%` }} /></div> : null}
                  {coverUpload.errorMode === 'edit' ? <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{coverUpload.error}</p> : null}
                </label>
                <label className="text-sm">Google Drive Folder URL
                  <input {...editForm.register('googleDriveFolderUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://drive.google.com/drive/folders/..." />
                </label>
                <label className="text-sm">Dropbox Folder URL
                  <input {...editForm.register('dropboxFolderUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://www.dropbox.com/..." />
                </label>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" {...editForm.register('isActive')} />
                  Active
                </label>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={updateMutation.isPending || coverUpload.mode === 'edit'}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <button type="button" onClick={() => setEditingAlbum(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminGalleryPage;
