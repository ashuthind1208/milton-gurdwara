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
    return <p className="mt-2 text-sm text-slate-500">No hukamnama added for this slot.</p>;
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

  const form = useForm({
    defaultValues: {
      date: toDateKey(new Date()),
      slot: 'morning',
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
    mutationFn: (values) => hukamnamaService.setScheduledHukamnama(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-hukamnama'] });
      queryClient.invalidateQueries({ queryKey: ['daily-hukamnama'] });
      queryClient.invalidateQueries({ queryKey: ['hukamnama-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['hukamnama-archive-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['hukamnama-archive'] });
      setAddModalOpen(false);
      setPreviewData(null);
      form.reset({ date: toDateKey(new Date()), slot: 'morning', ang: '' });
      window.alert('Hukamnama added successfully.');
    },
    onError: (error) => {
      window.alert(error?.message || 'Could not save hukamnama for selected date and slot.');
    }
  });

  const openAddModal = () => {
    setPreviewData(null);
    form.reset({ date: toDateKey(new Date()), slot: 'morning', ang: '' });
    setAddModalOpen(true);
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
        {marker.hasMorning ? <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" /> : null}
        {marker.hasEvening ? <span className="h-1.5 w-1.5 rounded-full bg-brand-saffron" /> : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold">Daily Hukamnama</h1>
        <Button type="button" onClick={openAddModal}>Add Hukamnama</Button>
      </div>

      <Card>
        <h2 className="font-heading text-lg font-semibold">Archive Calendar</h2>
        <p className="mt-1 text-xs text-slate-500">Click any date to open morning/evening hukamnama popup. Blue dot: morning, orange dot: evening.</p>
        <div className="mt-3">
          <ReactCalendar value={selectedDate} onChange={onCalendarSelect} tileContent={tileContent} className="w-full" style={{ width: '100%' }} />
        </div>
      </Card>

      <Card>
        <h3 className="font-heading text-xl font-semibold">Hukamnama • {selectedDateKey}</h3>
        <p className="mt-1 text-xs text-slate-500">Morning and evening entries for the selected calendar date.</p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">Morning</p>
            <HukamnamaText entry={selectedDateArchive?.morning} />
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">Evening</p>
            <HukamnamaText entry={selectedDateArchive?.evening} />
          </section>
        </div>
      </Card>

      {addModalOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-5xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Add Hukamnama</h3>
              <button type="button" onClick={() => setAddModalOpen(false)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>

            <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}>
              <label className="text-sm">Date
                <input type="date" {...form.register('date', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Slot
                <select {...form.register('slot')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </label>
              <label className="text-sm">Ang
                <input type="number" min="1" max="1430" {...form.register('ang', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => previewMutation.mutate(form.getValues('ang'))}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold"
                >
                  {previewMutation.isPending ? 'Loading...' : 'Load Preview'}
                </button>
              </div>

              <div className="md:col-span-4 rounded-lg bg-slate-50 p-4">
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

              <div className="md:col-span-4 flex gap-2">
                <Button type="submit" className="whitespace-nowrap" disabled={addMutation.isPending}>{addMutation.isPending ? 'Saving...' : 'Submit'}</Button>
                <button type="button" onClick={() => setAddModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminHukamnamaPage;
