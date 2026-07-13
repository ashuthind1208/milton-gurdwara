import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import galleryService from '../../services/galleryService';

const AdminGalleryPage = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold">Gallery Folders</h1>
        <Button type="button" onClick={() => setIsCreateOpen(true)}>Add Gallery Item</Button>
      </div>

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
                <input {...createForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Date
                <input type="date" {...createForm.register('eventDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Description
                <textarea {...createForm.register('description')} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Front Image URL
                <input {...createForm.register('frontImage')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://..." />
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
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Folder'}</Button>
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
                  <input {...editForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm">Date
                  <input type="date" {...editForm.register('eventDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm md:col-span-2">Description
                  <textarea {...editForm.register('description')} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm md:col-span-2">Front Image URL
                  <input {...editForm.register('frontImage')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://..." />
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
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
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
