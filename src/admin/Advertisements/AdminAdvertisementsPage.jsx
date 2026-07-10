import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import advertisementService, { AD_PLACEMENT_OPTIONS } from '../../services/advertisementService';

const placementOptions = AD_PLACEMENT_OPTIONS;

const groupedPlacementOptions = [
  {
    label: 'Homepage',
    options: placementOptions.filter((option) => option.startsWith('Homepage') || option === 'Global Banner')
  },
  {
    label: 'Seva Page',
    options: placementOptions.filter((option) => option.startsWith('Seva '))
  },
  {
    label: 'Donation Page',
    options: placementOptions.filter((option) => option.startsWith('Donation '))
  },
  {
    label: 'Library Page',
    options: placementOptions.filter((option) => option.startsWith('Library '))
  },
  {
    label: 'Events Page',
    options: placementOptions.filter((option) => option.startsWith('Events '))
  }
].filter((group) => group.options.length > 0);

const emptyFormValues = {
  title: '',
  content: '',
  website: '',
  imageUrl: '',
  bannerUrl: '',
  targetLink: '',
  placement: 'Homepage Sidebar',
  active: true
};

const AdminAdvertisementsPage = () => {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState({ open: false, mode: 'create', adId: null });

  const form = useForm({
    defaultValues: emptyFormValues
  });

  const { data: ads = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((res) => res.data)
  });

  const selectedAd = useMemo(() => ads.find((ad) => ad.id === modalState.adId) || null, [ads, modalState.adId]);

  const createMutation = useMutation({
    mutationFn: (values) => advertisementService.createAd(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      form.reset(emptyFormValues);
      setModalState({ open: false, mode: 'create', adId: null });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => advertisementService.updateAd(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      setModalState({ open: false, mode: 'create', adId: null });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => advertisementService.removeAd(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['advertisements'] })
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => advertisementService.updateAd(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['advertisements'] })
  });

  const openModal = (mode, ad = null) => {
    if (ad) {
      form.reset({
        title: ad.title || '',
        content: ad.content || '',
        website: ad.website || '',
        imageUrl: ad.imageUrl || '',
        bannerUrl: ad.bannerUrl || '',
        targetLink: ad.targetLink || '',
        placement: ad.placement || 'Homepage Sidebar',
        active: typeof ad.active === 'boolean' ? ad.active : true
      });
      setModalState({ open: true, mode, adId: ad.id });
      return;
    }

    form.reset(emptyFormValues);
    setModalState({ open: true, mode: 'create', adId: null });
  };

  const closeModal = () => {
    setModalState({ open: false, mode: 'create', adId: null });
  };

  const onSubmit = (values) => {
    if (modalState.mode === 'create') {
      createMutation.mutate(values);
      return;
    }

    if (modalState.mode === 'edit' && selectedAd) {
      updateMutation.mutate({ id: selectedAd.id, values });
    }
  };

  const isViewMode = modalState.mode === 'view';

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Advertisements</h1>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold">Advertisements Table</h2>
            <p className="mt-1 text-sm text-slate-600">View, edit, delete, and toggle active status directly from this table.</p>
          </div>
          <Button type="button" onClick={() => openModal('create')}>Create Advertisement</Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Placement</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ads.map((ad) => (
                <tr key={ad.id}>
                  <td className="px-3 py-2 font-semibold text-slate-800">{ad.title || 'Untitled ad'}</td>
                  <td className="px-3 py-2">{ad.placement}</td>
                  <td className="px-3 py-2">{ad.targetLink || ad.website || '-'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActiveMutation.mutate({ id: ad.id, active: !ad.active })}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ad.active ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}
                    >
                      {ad.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openModal('view', ad)} className="rounded-md border border-slate-300 p-1.5 text-slate-700" title="View"><EyeIcon className="h-4 w-4" /></button>
                      <button type="button" onClick={() => openModal('edit', ad)} className="rounded-md border border-slate-300 p-1.5 text-slate-700" title="Edit"><PencilSquareIcon className="h-4 w-4" /></button>
                      <button type="button" onClick={() => deleteMutation.mutate(ad.id)} className="rounded-md border border-red-200 p-1.5 text-red-700" title="Delete"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modalState.open ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">{modalState.mode === 'create' ? 'Create Advertisement' : modalState.mode === 'edit' ? 'Edit Advertisement' : 'View Advertisement'}</h3>
              <button type="button" onClick={closeModal} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>

            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
              <label className="text-sm">Advertiser Name
                <input disabled={isViewMode} {...form.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Placement
                <select disabled={isViewMode} {...form.register('placement')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50">
                  {groupedPlacementOptions.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => <option key={option}>{option}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">Content
                <textarea rows={3} disabled={isViewMode} {...form.register('content')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Website
                <input disabled={isViewMode} {...form.register('website')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Target Link
                <input disabled={isViewMode} {...form.register('targetLink')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Image URL
                <input disabled={isViewMode} {...form.register('imageUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Banner URL
                <input disabled={isViewMode} {...form.register('bannerUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <input type="checkbox" disabled={isViewMode} {...form.register('active')} />
                <span>Active</span>
              </label>
              {!isViewMode ? (
                <div className="md:col-span-2 flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Advertisement'}</Button>
                  <button type="button" onClick={closeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminAdvertisementsPage;
