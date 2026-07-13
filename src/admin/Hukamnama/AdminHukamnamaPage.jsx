import { useMemo, useState } from 'react';
import ReactCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import hukamnamaService from '../../services/hukamnamaService';

const toDateKey = (value = new Date()) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const HukamnamaText = ({ entry }) => {
  if (!entry) {
    return <p className="mt-2 text-sm text-slate-500">No hukamnama added for this date yet.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-sm font-semibold text-brand-blue">Ang {entry.ang}</p>
      {(entry.lines || []).map((line) => (
        <div key={line.id}>
          <p className="font-gurmukhi text-lg font-normal text-brand-navy">{line.gurmukhi}</p>
          {line.translationPunjabi ? <p className="mt-1 text-sm text-brand-saffron">Punjabi: {line.translationPunjabi}</p> : null}
          {line.translationEnglish ? <p className="mt-0.5 text-sm text-brand-blue">English: {line.translationEnglish}</p> : null}
        </div>
      ))}
    </div>
  );
};

const AdminHukamnamaPage = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [editingDateKey, setEditingDateKey] = useState('');

  const form = useForm({
    defaultValues: {
      date: toDateKey(new Date()),
      ang: ''
    }
  });

  const selectedDateKey = toDateKey(selectedDate);

  const { data: archiveCalendar = [] } = useQuery({
    queryKey: ['hukamnama-calendar'],
    queryFn: () => hukamnamaService.getArchiveCalendar().then((res) => res.data)
  });

  const { data: selectedDateArchive } = useQuery({
    queryKey: ['hukamnama-archive-by-date', selectedDateKey],
    queryFn: () => hukamnamaService.getArchiveByDate(selectedDateKey).then((res) => res.data)
  });

  const archiveMap = useMemo(
    () => archiveCalendar.reduce((acc, entry) => {
      acc[entry.date] = entry;
      return acc;
    }, {}),
    [archiveCalendar]
  );

  const previewMutation = useMutation({
    mutationFn: (ang) => hukamnamaService.getAngPreview(ang),
    onSuccess: (response) => {
      setPreviewData(response.data);
    },
    onError: (error) => {
      window.alert(error?.message || 'Could not load preview for this ang.');
      setPreviewData(null);
    }
  });

  const addMutation = useMutation({
    mutationFn: (values) => (editingDateKey
      ? hukamnamaService.updateScheduledHukamnama(values)
      : hukamnamaService.setScheduledHukamnama(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-hukamnama'] });
      queryClient.invalidateQueries({ queryKey: ['daily-hukamnama'] });
      queryClient.invalidateQueries({ queryKey: ['hukamnama-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['hukamnama-archive-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['hukamnama-archive'] });
      setAddModalOpen(false);
      setEditingDateKey('');
      setPreviewData(null);
      form.reset({ date: toDateKey(new Date()), ang: '' });
      window.alert(editingDateKey ? 'Hukamnama updated successfully.' : 'Hukamnama added successfully.');
    },
    onError: (error) => {
      window.alert(error?.message || 'Could not save hukamnama for selected date.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (dateKey) => hukamnamaService.deleteScheduledHukamnama(dateKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-hukamnama'] });
      queryClient.invalidateQueries({ queryKey: ['daily-hukamnama'] });
      queryClient.invalidateQueries({ queryKey: ['hukamnama-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['hukamnama-archive-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['hukamnama-archive'] });
      setEditingDateKey('');
      setPreviewData(null);
      window.alert('Hukamnama deleted successfully.');
    },
    onError: (error) => {
      window.alert(error?.message || 'Could not delete hukamnama for selected date.');
    }
  });

  const openAddModal = () => {
    setPreviewData(null);
    setEditingDateKey('');
    form.reset({ date: selectedDateKey, ang: '' });
    setAddModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedDateArchive?.entry) {
      return;
    }

    setEditingDateKey(selectedDateKey);
    setPreviewData(selectedDateArchive.entry);
    form.reset({ date: selectedDateKey, ang: String(selectedDateArchive.entry.ang || '') });
    setAddModalOpen(true);
  };

  const handleDelete = () => {
    if (!selectedDateArchive?.entry) {
      return;
    }

    if (!window.confirm(`Delete hukamnama for ${selectedDateKey}?`)) {
      return;
    }

    deleteMutation.mutate(selectedDateKey);
  };

  const onCalendarSelect = (value) => {
    const next = Array.isArray(value) ? value[0] : value;
    setSelectedDate(next);
  };

  const tileContent = ({ date, view }) => {
    if (view !== 'month') {
      return null;
    }

    const marker = archiveMap[toDateKey(date)];
    if (!marker) {
      return null;
    }

    return (
      <div className="mt-1 flex items-center justify-center gap-1">
        {marker.hasEntry ? <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" /> : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold">Daily Hukamnama</h1>
        <Button type="button" onClick={openAddModal}>Add Hukamnama</Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <h2 className="font-heading text-lg font-semibold">Archive Calendar</h2>
          <p className="mt-1 text-xs text-slate-500">Click any date to view its single hukamnama entry.</p>
          <div className="mt-3">
            <ReactCalendar value={selectedDate} onChange={onCalendarSelect} tileContent={tileContent} className="w-full" style={{ width: '100%' }} />
          </div>
        </Card>

        <Card>
          <h3 className="font-heading text-xl font-semibold">Hukamnama • {selectedDateKey}</h3>
          <p className="mt-1 text-xs text-slate-500">Single daily hukamnama preview for the selected calendar date.</p>
          {selectedDateArchive?.entry ? (
            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={openEditModal}>Edit Hukamnama</Button>
              <Button type="button" variant="ghost" onClick={handleDelete} disabled={deleteMutation.isPending} className="text-red-700 ring-red-200 hover:bg-red-50">
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Hukamnama'}
              </Button>
            </div>
          ) : null}
          <div className="mt-4">
            <HukamnamaText entry={selectedDateArchive?.entry} />
          </div>
        </Card>
      </div>

      {addModalOpen ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-5xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">{editingDateKey ? 'Edit Hukamnama' : 'Add Hukamnama'}</h3>
              <button type="button" onClick={() => setAddModalOpen(false)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>

            <form className="mt-4 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}>
              <div className="space-y-3">
                <label className="text-sm">Date
                  <input type="date" {...form.register('date', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm">Ang
                  <input type="number" min="1" max="1430" {...form.register('ang', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <button
                  type="button"
                  onClick={() => previewMutation.mutate(form.getValues('ang'))}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold"
                >
                  {previewMutation.isPending ? 'Loading...' : 'Load Preview'}
                </button>
                <div className="flex gap-2">
                  <Button type="submit" className="whitespace-nowrap" disabled={addMutation.isPending}>{addMutation.isPending ? 'Saving...' : 'Submit'}</Button>
                  <button type="button" onClick={() => setAddModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Preview</p>
                {!previewData ? (
                  <p className="mt-2 text-sm text-slate-500">Load preview to verify the selected ang before submitting.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm font-semibold text-brand-blue">Ang {previewData.ang}</p>
                    {(previewData.lines || []).slice(0, 4).map((line) => (
                      <div key={line.id}>
                        <p className="font-gurmukhi text-lg font-normal text-brand-navy">{line.gurmukhi}</p>
                        {line.translationPunjabi ? <p className="mt-1 text-sm text-brand-saffron">Punjabi: {line.translationPunjabi}</p> : null}
                        {line.translationEnglish ? <p className="mt-0.5 text-sm text-brand-blue">English: {line.translationEnglish}</p> : null}
                      </div>
                    ))}
                    {(previewData.lines || []).length > 4 ? <p className="text-xs text-slate-500">Showing first 4 lines in preview.</p> : null}
                  </div>
                )}
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminHukamnamaPage;
