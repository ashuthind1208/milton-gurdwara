import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import galleryService from '../../services/galleryService';

const AdminGalleryPage = () => {
  const queryClient = useQueryClient();
  const [editingAlbum, setEditingAlbum] = useState(null);

  const createForm = useForm({ defaultValues: { title: '', eventDate: '', folderUrl: '', images: [{ url: '', caption: '' }] } });
  const editForm = useForm({ defaultValues: { title: '', eventDate: '', folderUrl: '', images: [{ url: '', caption: '' }] } });

  const createImages = useFieldArray({ control: createForm.control, name: 'images' });
  const editImages = useFieldArray({ control: editForm.control, name: 'images' });

  const { data: albums = [] } = useQuery({
    queryKey: ['gallery'],
    queryFn: () => galleryService.getAlbums().then((res) => res.data)
  });

  const createMutation = useMutation({
    mutationFn: (values) => galleryService.createAlbum({
      ...values,
      images: (values.images || []).filter((image) => image.url || image.caption)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      createForm.reset({ title: '', eventDate: '', folderUrl: '', images: [{ url: '', caption: '' }] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => galleryService.updateAlbum(id, {
      ...values,
      images: (values.images || []).filter((image) => image.url || image.caption)
    }),
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
      eventDate: album.eventDate || '',
      folderUrl: album.folderUrl || '',
      images: (album.images || []).length > 0 ? album.images.map((image) => ({ url: image.url || '', caption: image.caption || '' })) : [{ url: '', caption: '' }]
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Gallery Folders</h1>

      <Card>
        <h2 className="font-heading text-xl font-semibold">Create Event Folder</h2>
        <form className="mt-4 space-y-4" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">Event Title
              <input {...createForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            <label className="text-sm">Event Date
              <input type="date" {...createForm.register('eventDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            <label className="text-sm md:col-span-2">Folder Link (Google Drive/Dropbox/public folder)
              <input {...createForm.register('folderUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://drive.google.com/drive/folders/..." />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Images (Link + Caption)</h3>
              <button type="button" className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold" onClick={() => createImages.append({ url: '', caption: '' })}>Add Image</button>
            </div>
            {createImages.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-2">
                <label className="text-sm">Image Link
                  <input {...createForm.register(`images.${index}.url`)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm">Caption
                  <input {...createForm.register(`images.${index}.caption`)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <div className="md:col-span-2">
                  <button type="button" onClick={() => createImages.remove(index)} className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">Remove</button>
                </div>
              </div>
            ))}
          </div>

          <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Folder'}</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {albums.map((album) => (
          <Card key={album.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800">{album.title}</p>
              <p className="text-sm text-slate-600">{album.eventDate || 'No date'} • {album.items} images{album.folderUrl ? ' • Folder linked' : ''}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openEdit(album)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">Edit</button>
              <button type="button" onClick={() => deleteMutation.mutate(album.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Delete</button>
            </div>
          </Card>
        ))}
      </div>

      {editingAlbum ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Folder</h3>
              <button type="button" onClick={() => setEditingAlbum(null)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingAlbum.id, values }))}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">Event Title
                  <input {...editForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm">Event Date
                  <input type="date" {...editForm.register('eventDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm md:col-span-2">Folder Link (Google Drive/Dropbox/public folder)
                  <input {...editForm.register('folderUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://drive.google.com/drive/folders/..." />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Images (Link + Caption)</h3>
                  <button type="button" className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold" onClick={() => editImages.append({ url: '', caption: '' })}>Add Image</button>
                </div>
                {editImages.fields.map((field, index) => (
                  <div key={field.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-2">
                    <label className="text-sm">Image Link
                      <input {...editForm.register(`images.${index}.url`)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                    </label>
                    <label className="text-sm">Caption
                      <input {...editForm.register(`images.${index}.caption`)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                    </label>
                    <div className="md:col-span-2">
                      <button type="button" onClick={() => editImages.remove(index)} className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">Remove</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <button type="button" onClick={() => setEditingAlbum(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminGalleryPage;
