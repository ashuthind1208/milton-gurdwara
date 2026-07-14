import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import sponsorService from '../../services/sponsorService';
import uploadService from '../../services/uploadService';
import StatusAlert from '../../components/common/StatusAlert';

const emptyFormValues = {
  title: '',
  bannerUrl: '',
  expiryDate: '',
  active: true
};

const formatDate = (value) => {
  const parsed = new Date(value || '');
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }
  return parsed.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: '2-digit' });
};

const toInputDate = (value) => {
  const parsed = new Date(value || '');
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const AdminSponsorsPage = () => {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState({ open: false, mode: 'create', sponsorId: null });
  const form = useForm({ defaultValues: emptyFormValues });
  const [uploadingField, setUploadingField] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ bannerUrl: 0 });
  const [uploadStatus, setUploadStatus] = useState({ type: 'success', message: '' });

  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => sponsorService.getSponsors().then((res) => res.data)
  });

  const selectedSponsor = useMemo(
    () => sponsors.find((entry) => String(entry.id) === String(modalState.sponsorId)) || null,
    [modalState.sponsorId, sponsors]
  );

  const createMutation = useMutation({
    mutationFn: (values) => sponsorService.createSponsor(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      closeModal();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => sponsorService.updateSponsor(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      closeModal();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => sponsorService.removeSponsor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => sponsorService.updateSponsor(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    }
  });

  const closeModal = () => {
    setModalState({ open: false, mode: 'create', sponsorId: null });
    form.reset(emptyFormValues);
    setUploadStatus({ type: 'success', message: '' });
    setUploadingField('');
    setUploadProgress({ bannerUrl: 0 });
  };

  const openModal = (mode, sponsor = null) => {
    if (!sponsor) {
      form.reset(emptyFormValues);
      setModalState({ open: true, mode, sponsorId: null });
      return;
    }

    form.reset({
      title: sponsor.title || '',
      bannerUrl: sponsor.bannerUrl || '',
      expiryDate: toInputDate(sponsor.expiryDate),
      active: typeof sponsor.active === 'boolean' ? sponsor.active : true
    });
    setModalState({ open: true, mode, sponsorId: sponsor.id });
  };

  const onSubmit = (values) => {
    const payload = {
      title: String(values.title || '').trim(),
      bannerUrl: String(values.bannerUrl || '').trim(),
      expiryDate: values.expiryDate ? new Date(values.expiryDate).toISOString() : '',
      active: Boolean(values.active)
    };

    if (modalState.mode === 'create') {
      createMutation.mutate(payload);
      return;
    }

    if (selectedSponsor) {
      updateMutation.mutate({
        id: selectedSponsor.id,
        values: {
          ...payload,
          createdAt: selectedSponsor.createdAt
        }
      });
    }
  };

  const uploadAndSetField = async (fieldName, file) => {
    if (!file) {
      return;
    }

    try {
      setUploadingField(fieldName);
      setUploadProgress((prev) => ({ ...prev, [fieldName]: 0 }));
      const uploaded = await uploadService.uploadFile({
        service: 'sponsors',
        file,
        allowedMimeTypes: ['image/*'],
        maxSizeMB: 15,
        onProgress: (percent) => setUploadProgress((prev) => ({ ...prev, [fieldName]: percent }))
      });

      const nextUrl = uploaded?.url || '';
      if (!nextUrl) {
        throw new Error('Upload did not return a file URL.');
      }

      form.setValue(fieldName, nextUrl, { shouldDirty: true, shouldValidate: true });
      setUploadStatus({ type: 'success', message: 'Banner uploaded successfully.' });
    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message || 'Unable to upload banner.' });
    } finally {
      setUploadingField('');
      setUploadProgress((prev) => ({ ...prev, [fieldName]: 0 }));
    }
  };

  const isViewMode = modalState.mode === 'view';

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Sponsors</h1>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold">Sponsors Table</h2>
            <p className="mt-1 text-sm text-slate-600">Manage event sponsor names shown on the donation board footer ticker.</p>
          </div>
          <Button type="button" onClick={() => openModal('create')}>Add Sponsor</Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Date Added</th>
                <th className="px-3 py-2">Expiry Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sponsors.map((sponsor) => (
                <tr key={sponsor.id}>
                  <td className="px-3 py-2 font-semibold text-slate-800">{sponsor.title || 'Untitled sponsor'}</td>
                  <td className="px-3 py-2">{formatDate(sponsor.createdAt)}</td>
                  <td className="px-3 py-2">{formatDate(sponsor.expiryDate)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActiveMutation.mutate({ id: sponsor.id, active: !sponsor.active })}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sponsor.active ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}
                    >
                      {sponsor.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openModal('view', sponsor)} className="rounded-md border border-slate-300 p-1.5 text-slate-700" title="View"><EyeIcon className="h-4 w-4" /></button>
                      <button type="button" onClick={() => openModal('edit', sponsor)} className="rounded-md border border-slate-300 p-1.5 text-slate-700" title="Edit"><PencilSquareIcon className="h-4 w-4" /></button>
                      <button type="button" onClick={() => deleteMutation.mutate(sponsor.id)} className="rounded-md border border-red-200 p-1.5 text-red-700" title="Delete"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modalState.open ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-xl font-semibold">{modalState.mode === 'create' ? 'Add Sponsor' : modalState.mode === 'edit' ? 'Edit Sponsor' : 'View Sponsor'}</h3>
                <button type="button" onClick={closeModal} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
              </div>

              <form className="mt-4 grid gap-3" onSubmit={form.handleSubmit(onSubmit)}>
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />

                <label className="text-sm">Sponsor Title
                  <input disabled={isViewMode} {...form.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
                </label>

                <label className="text-sm">Expiry Date
                  <input type="date" disabled={isViewMode} {...form.register('expiryDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
                </label>

                <label className="text-sm">Banner Image URL
                  <input disabled={isViewMode} {...form.register('bannerUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
                  <p className="mt-1 text-xs text-slate-500">Recommended size: 1200 x 300 px (or similar wide banner).</p>
                  {!isViewMode ? (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        className="mt-2 block w-full text-xs"
                        onChange={(event) => uploadAndSetField('bannerUrl', event.target.files?.[0])}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        {uploadingField === 'bannerUrl' ? `Uploading banner... ${uploadProgress.bannerUrl}%` : 'You can either paste image URL above or upload a banner file (max 15MB).'}
                      </p>
                      {uploadingField === 'bannerUrl' ? (
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full bg-brand-blue transition-all" style={{ width: `${uploadProgress.bannerUrl}%` }} />
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </label>

                {selectedSponsor ? (
                  <label className="text-sm">Date Added
                    <input value={formatDate(selectedSponsor.createdAt)} disabled className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5" />
                  </label>
                ) : null}

                <label className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <input type="checkbox" disabled={isViewMode} {...form.register('active')} />
                  <span>Active</span>
                </label>

                {!isViewMode ? (
                  <div className="flex gap-2">
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Sponsor'}
                    </Button>
                    <button type="button" onClick={closeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminSponsorsPage;
