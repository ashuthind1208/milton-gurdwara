import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircleIcon,
  EyeIcon,
  LockClosedIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import cmsService from '../../services/cmsService';

const HOURS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const MINUTES = ['00', '15', '30', '45'];
const MERIDIEM = ['AM', 'PM'];

const toDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isValidDateKey = (value = '') => /^\d{4}-\d{2}-\d{2}$/.test(value);

const formatDateLabel = (dateKey) => {
  if (!isValidDateKey(dateKey)) {
    return dateKey;
  }
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatWeekday = (dateKey) => {
  if (!isValidDateKey(dateKey)) {
    return '';
  }
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' });
};

const getYearDateKeys = (year) => {
  const start = new Date(year, 0, 1, 12, 0, 0);
  const days = [];
  for (let index = 0; index < 365; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    days.push(toDateKey(date));
  }
  return days;
};

const formatSlotTime = (hour, minute, meridiem) => `${hour}:${minute} ${meridiem}`;

const parseTimeRange = (value = '') => {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)(?:\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM))?$/i);

  if (!match) {
    return {
      startHour: '5',
      startMinute: '00',
      startMeridiem: 'AM',
      hasEnd: false,
      endHour: '5',
      endMinute: '15',
      endMeridiem: 'AM'
    };
  }

  return {
    startHour: match[1],
    startMinute: match[2],
    startMeridiem: match[3].toUpperCase(),
    hasEnd: Boolean(match[4]),
    endHour: match[4] || '5',
    endMinute: match[5] || '15',
    endMeridiem: (match[6] || 'AM').toUpperCase()
  };
};

const buildTimeRange = (values) => {
  const start = formatSlotTime(values.startHour, values.startMinute, values.startMeridiem);
  if (!values.hasEnd) {
    return start;
  }
  const end = formatSlotTime(values.endHour, values.endMinute, values.endMeridiem);
  return `${start} - ${end}`;
};

const buildEmptyEntry = (segment = 'morning') => ({
  id: `schedule-entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  segment,
  timeEn: '',
  timePa: '',
  titleEn: '',
  titlePa: '',
  noteEn: '',
  notePa: '',
  isHighlighted: false,
  isActive: true,
  sortOrder: 0
});

const buildEmptyDay = (dateKey = 'default', entries = []) => ({
  dateKey,
  dateLabel: dateKey === 'default' ? 'Daily Default' : formatDateLabel(dateKey),
  title: dateKey === 'default' ? 'Standard Daily Maryada' : 'Special Day Schedule',
  isSpecial: dateKey !== 'default',
  highlightTitle: '',
  highlightNoteEn: '',
  highlightNotePa: '',
  entries
});

const normalizeEntry = (entry = {}, index = 0) => ({
  ...buildEmptyEntry(entry.segment || 'morning'),
  ...entry,
  isActive: entry.isActive !== false,
  sortOrder: Number.isFinite(Number(entry.sortOrder)) ? Number(entry.sortOrder) : index + 1
});

const entryFormDefaults = {
  segment: 'morning',
  startHour: '5',
  startMinute: '00',
  startMeridiem: 'AM',
  hasEnd: false,
  endHour: '5',
  endMinute: '15',
  endMeridiem: 'AM',
  timePa: '',
  titleEn: '',
  titlePa: '',
  noteEn: '',
  notePa: '',
  isHighlighted: false,
  isActive: true
};

const segmentOptions = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'special', label: 'Special' }
];

const segmentClassMap = {
  morning: 'bg-sky-100 text-sky-800',
  evening: 'bg-amber-100 text-amber-800',
  special: 'bg-rose-100 text-rose-800'
};

const statusPillClass = (isActive) => (
  isActive
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
    : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400'
);

const sortEntries = (entries = []) => entries
  .map((entry, index) => normalizeEntry(entry, index))
  .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
  .map((entry, index) => ({ ...entry, sortOrder: index + 1 }));

const AdminSchedulePage = () => {
  const queryClient = useQueryClient();
  const todayDateKey = toDateKey(new Date());
  const currentYear = new Date().getFullYear();
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [dayFilter, setDayFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dayModal, setDayModal] = useState({ open: false, mode: 'view' });
  const [entryModal, setEntryModal] = useState({ open: false, mode: 'create', entryId: null });
  const form = useForm({ defaultValues: entryFormDefaults });

  const isPastDateKey = useCallback(
    (dateKey) => dateKey !== 'default' && isValidDateKey(dateKey) && dateKey < todayDateKey,
    [todayDateKey]
  );

  const { data: cmsData } = useQuery({
    queryKey: ['cms-home'],
    queryFn: () => cmsService.getHomeContent().then((res) => res.data)
  });

  const scheduleDays = useMemo(() => Array.isArray(cmsData?.scheduleDays) ? cmsData.scheduleDays : [], [cmsData]);
  const scheduleMap = useMemo(() => {
    const map = new Map();
    scheduleDays.forEach((day) => {
      map.set(day.dateKey, {
        ...day,
        entries: sortEntries(day.entries || [])
      });
    });
    return map;
  }, [scheduleDays]);

  const defaultDay = useMemo(() => (
    scheduleMap.get('default') || buildEmptyDay('default')
  ), [scheduleMap]);

  const selectedDay = useMemo(() => {
    if (selectedDateKey === 'default') {
      return {
        ...defaultDay,
        isSpecial: false,
        entries: sortEntries(defaultDay.entries || [])
      };
    }

    const existing = scheduleMap.get(selectedDateKey);
    if (existing) {
      return {
        ...existing,
        isSpecial: existing.isSpecial !== false,
        entries: sortEntries(existing.entries || [])
      };
    }

    return {
      ...buildEmptyDay(selectedDateKey, defaultDay.entries || []),
      isSpecial: false,
      entries: sortEntries(defaultDay.entries || [])
    };
  }, [defaultDay, scheduleMap, selectedDateKey]);

  const saveDayMutation = useMutation({
    mutationFn: (nextEntries) => cmsService.updateSchedule({
      day: {
        ...selectedDay,
        dateKey: selectedDateKey,
        dateLabel: selectedDateKey === 'default' ? 'Daily Default' : formatDateLabel(selectedDateKey),
        title: selectedDateKey === 'default' ? 'Standard Daily Maryada' : 'Special Day Schedule',
        isSpecial: selectedDateKey !== 'default',
        entries: sortEntries(nextEntries)
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
    }
  });

  const removeDayMutation = useMutation({
    mutationFn: () => cmsService.removeScheduleDay(selectedDateKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
      setSelectedDateKey(toDateKey(new Date()));
      closeEntryModal();
      closeDayModal();
    }
  });

  const closeEntryModal = () => {
    setEntryModal({ open: false, mode: 'create', entryId: null });
  };

  const closeDayModal = () => {
    setDayModal({ open: false, mode: 'view' });
  };

  const openDayModal = (dateKey, mode = 'view') => {
    setSelectedDateKey(dateKey);
    setDayModal({ open: true, mode });
  };

  const openCreateModal = () => {
    form.reset({ ...entryFormDefaults });
    setEntryModal({ open: true, mode: 'create', entryId: null });
  };

  const openEditModal = (entry) => {
    const parsed = parseTimeRange(entry.timeEn);
    form.reset({
      segment: entry.segment || 'morning',
      ...parsed,
      timePa: entry.timePa || '',
      titleEn: entry.titleEn || '',
      titlePa: entry.titlePa || '',
      noteEn: entry.noteEn || '',
      notePa: entry.notePa || '',
      isHighlighted: Boolean(entry.isHighlighted),
      isActive: entry.isActive !== false
    });
    setEntryModal({ open: true, mode: 'edit', entryId: entry.id });
  };

  const rows = selectedDay.entries || [];
  const isSelectedDayPast = isPastDateKey(selectedDateKey);
  const isDayModalReadOnly = dayModal.mode === 'view' || isSelectedDayPast;

  const handleSaveEntry = (values) => {
    const nextPayload = {
      segment: values.segment,
      timeEn: buildTimeRange(values),
      timePa: values.timePa,
      titleEn: values.titleEn,
      titlePa: values.titlePa,
      noteEn: values.noteEn,
      notePa: values.notePa,
      isHighlighted: Boolean(values.isHighlighted),
      isActive: values.isActive !== false
    };

    if (entryModal.mode === 'edit' && entryModal.entryId) {
      const nextEntries = sortEntries(rows.map((entry) => (
        entry.id === entryModal.entryId ? { ...entry, ...nextPayload } : entry
      )));
      saveDayMutation.mutate(nextEntries, { onSuccess: closeEntryModal });
      return;
    }

    const nextEntries = sortEntries([...rows, normalizeEntry(nextPayload, rows.length)]);
    saveDayMutation.mutate(nextEntries, { onSuccess: closeEntryModal });
  };

  const handleDeleteEntry = (entryId) => {
    if (isSelectedDayPast) {
      return;
    }
    const nextEntries = sortEntries(rows.filter((entry) => entry.id !== entryId));
    saveDayMutation.mutate(nextEntries);
  };

  const handleToggleActive = (entry) => {
    if (isSelectedDayPast) {
      return;
    }
    const nextEntries = sortEntries(rows.map((item) => (
      item.id === entry.id ? { ...item, isActive: item.isActive === false } : item
    )));
    saveDayMutation.mutate(nextEntries);
  };

  const yearRows = useMemo(() => {
    const dateKeys = getYearDateKeys(yearFilter);
    return dateKeys.map((dateKey) => {
      const day = scheduleMap.get(dateKey);
      const isSpecial = Boolean(day) && day?.isSpecial !== false;
      const effectiveEntries = day?.entries?.length ? day.entries : (defaultDay.entries || []);
      return {
        dateKey,
        weekday: formatWeekday(dateKey),
        type: isSpecial ? 'Special' : 'Default',
        isPast: isPastDateKey(dateKey),
        eventCount: effectiveEntries.filter((item) => item.isActive !== false).length
      };
    });
  }, [defaultDay.entries, isPastDateKey, scheduleMap, yearFilter]);

  const filteredYearRows = useMemo(() => {
    const query = dayFilter.trim().toLowerCase();
    if (!query) {
      return yearRows;
    }

    return yearRows.filter((row) => (
      row.dateKey.toLowerCase().includes(query)
      || row.weekday.toLowerCase().includes(query)
      || row.type.toLowerCase().includes(query)
      || (row.isPast ? 'inactive' : 'active').includes(query)
    ));
  }, [dayFilter, yearRows]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredYearRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredYearRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Daily Schedule</h1>
        <p className="mt-1 text-sm text-slate-600">Schedule editing opens in a popup. Use the year table actions to view or edit a day.</p>
      </div>

      <Card className="border border-slate-200 bg-white">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-slate-900">365-Day Schedule Table</h2>
            <p className="text-xs text-slate-500">Each day starts from default schedule. Any edited date is marked as Special.</p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[130px_1fr_auto] sm:items-end">
            <label className="text-sm font-medium text-slate-700">
              <span className="mb-1 block">Year</span>
              <input
                type="number"
                min={2000}
                max={2100}
                value={yearFilter}
                onChange={(event) => {
                  const nextYear = Number(event.target.value);
                  if (Number.isFinite(nextYear)) {
                    setYearFilter(nextYear);
                    setPage(1);
                  }
                }}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/20"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              <span className="mb-1 block">Filter Days</span>
              <input
                type="text"
                placeholder="Date, weekday, type, active"
                value={dayFilter}
                onChange={(event) => {
                  setDayFilter(event.target.value);
                  setPage(1);
                }}
                className="h-11 w-full min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/20"
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl px-4"
              onClick={() => {
                setYearFilter(currentYear);
                setDayFilter('');
                setPage(1);
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Day</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Events</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.dateKey} className={`border-b border-slate-100 ${selectedDateKey === row.dateKey ? 'bg-blue-50/60' : ''}`}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">{row.dateKey}</td>
                  <td className="py-2.5 pr-3 text-slate-700">{row.weekday}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.type === 'Special' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${row.isPast ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'}`}>
                      {row.isPast ? <XCircleIcon className="h-3.5 w-3.5" /> : <CheckCircleIcon className="h-3.5 w-3.5" />}
                      {row.isPast ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700">{row.eventCount}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDayModal(row.dateKey, 'view')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                        aria-label={`View ${row.dateKey}`}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDayModal(row.dateKey, 'edit')}
                        disabled={row.isPast}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${row.isPast ? 'cursor-not-allowed border-slate-200 text-slate-400' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                        aria-label={`Edit ${row.dateKey}`}
                      >
                        {row.isPast ? <LockClosedIcon className="h-4 w-4" /> : <PencilSquareIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pagedRows.length === 0 ? (
                <tr>
                  <td className="py-3 text-center text-slate-500" colSpan={6}>No rows match your filter.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredYearRows.length)} of {filteredYearRows.length}</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage === 1}>Previous</Button>
            <Button type="button" variant="ghost" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage === totalPages}>Next</Button>
          </div>
        </div>
      </Card>

      {dayModal.open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeDayModal} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-semibold">{formatDateLabel(selectedDateKey)}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${selectedDay.isSpecial ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                    {selectedDay.isSpecial ? 'Special' : 'Default'}
                  </span>
                  {isSelectedDayPast ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      <LockClosedIcon className="h-3.5 w-3.5" /> Past date locked
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isDayModalReadOnly ? (
                  <Button type="button" onClick={openCreateModal} className="inline-flex items-center gap-1.5">
                    <PlusIcon className="h-4 w-4" /> Add Event
                  </Button>
                ) : null}
                {!isDayModalReadOnly && selectedDateKey !== 'default' ? (
                  <Button type="button" variant="ghost" onClick={() => removeDayMutation.mutate()} disabled={removeDayMutation.isPending}>Reset To Default</Button>
                ) : null}
                <button type="button" onClick={closeDayModal} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close day modal">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Content</th>
                    <th className="py-2 pr-3">Section</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-3 font-semibold text-slate-900">{entry.timeEn || '-'}</td>
                      <td className="py-3 pr-3 text-slate-700">{entry.titleEn || '-'}</td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${segmentClassMap[entry.segment] || segmentClassMap.morning}`}>{entry.segment}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          disabled={isDayModalReadOnly}
                          onClick={() => handleToggleActive(entry)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${statusPillClass(entry.isActive !== false)} ${isDayModalReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          {entry.isActive === false ? <XCircleIcon className="h-3.5 w-3.5" /> : <CheckCircleIcon className="h-3.5 w-3.5" />}
                          {entry.isActive === false ? 'Inactive' : 'Active'}
                        </button>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={isDayModalReadOnly}
                            onClick={() => openEditModal(entry)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${isDayModalReadOnly ? 'cursor-not-allowed border-slate-200 text-slate-400' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                            aria-label="Edit row"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isDayModalReadOnly}
                            onClick={() => handleDeleteEntry(entry.id)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${isDayModalReadOnly ? 'cursor-not-allowed border-slate-200 text-slate-400' : 'border-rose-200 text-rose-700 hover:bg-rose-50'}`}
                            aria-label="Delete row"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td className="py-4 text-center text-slate-500" colSpan={5}>No schedule rows for this day yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {entryModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeEntryModal} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold">{entryModal.mode === 'edit' ? 'Edit Event' : 'Add Event'}</h3>
              <button type="button" onClick={closeEntryModal} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close add row modal">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(handleSaveEntry)}>
              <label className="text-sm">Section
                <select {...form.register('segment')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  {segmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm md:self-end">
                <input type="checkbox" {...form.register('isActive')} /> Active row
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Time Slot (15-minute steps)</p>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_1fr_1fr_1fr]">
                  <select {...form.register('startHour')} className="rounded-lg border border-slate-300 p-2.5">
                    {HOURS.map((hour) => <option key={`start-hour-${hour}`} value={hour}>{hour}</option>)}
                  </select>
                  <select {...form.register('startMinute')} className="rounded-lg border border-slate-300 p-2.5">
                    {MINUTES.map((minute) => <option key={`start-minute-${minute}`} value={minute}>{minute}</option>)}
                  </select>
                  <select {...form.register('startMeridiem')} className="rounded-lg border border-slate-300 p-2.5">
                    {MERIDIEM.map((value) => <option key={`start-meridiem-${value}`} value={value}>{value}</option>)}
                  </select>
                  <label className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-600">
                    <input type="checkbox" {...form.register('hasEnd')} /> End
                  </label>
                  <select {...form.register('endHour')} className="rounded-lg border border-slate-300 p-2.5">
                    {HOURS.map((hour) => <option key={`end-hour-${hour}`} value={hour}>{hour}</option>)}
                  </select>
                  <select {...form.register('endMinute')} className="rounded-lg border border-slate-300 p-2.5">
                    {MINUTES.map((minute) => <option key={`end-minute-${minute}`} value={minute}>{minute}</option>)}
                  </select>
                  <select {...form.register('endMeridiem')} className="rounded-lg border border-slate-300 p-2.5">
                    {MERIDIEM.map((value) => <option key={`end-meridiem-${value}`} value={value}>{value}</option>)}
                  </select>
                </div>
              </div>

              <label className="text-sm">Time (Punjabi)
                <input {...form.register('timePa')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>

              <label className="text-sm">Content (English)
                <input {...form.register('titleEn', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Content (Punjabi)
                <input {...form.register('titlePa')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Notes (English)
                <textarea rows={2} {...form.register('noteEn')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Notes (Punjabi)
                <textarea rows={2} {...form.register('notePa')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" {...form.register('isHighlighted')} /> Highlight this row for the homepage
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={saveDayMutation.isPending}>{saveDayMutation.isPending ? 'Saving...' : 'OK'}</Button>
                <Button type="button" variant="ghost" onClick={closeEntryModal}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminSchedulePage;
