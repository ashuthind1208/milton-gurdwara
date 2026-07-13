import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import libraryService from '../../services/libraryService';
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from '../../services/videoService';
import { siteConfig } from '../../constants/siteConfig';
import { downloadRegistrationCsv, downloadRegistrationPdf } from '../../utils/csvExport';

const actionIconClass = 'h-4 w-4';
const PAGE_SIZE = 10;

const emptyPhysicalForm = {
  title: '',
  author: '',
  category: '',
  isbn: '',
  totalCopies: 1,
  notes: ''
};

const emptyDigitalForm = {
  title: '',
  fileType: 'PDF',
  description: '',
  downloadUrl: '',
  coverImageUrl: '',
  tags: ''
};

const emptyProgramForm = {
  title: '',
  speaker: '',
  audience: '',
  scheduleDate: '',
  scheduleTime: '',
  location: '',
  summary: '',
  imageUrl: '',
  registrationUrl: '/events'
};

const emptyIssueForm = {
  copyNumber: 1,
  issuerName: '',
  issuerPhone: '',
  issueDate: new Date().toISOString().slice(0, 10),
  returnDate: ''
};

const emptyMediaForm = {
  title: '',
  mediaType: 'youtube',
  url: '',
  description: '',
  thumbnailUrl: '',
  tags: ''
};

const Pagination = ({ page, total, onChange }) => {
  if (total <= 1) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        type="button"
        className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Prev
      </button>
      <span className="text-xs font-semibold text-slate-600">Page {page} of {total}</span>
      <button
        type="button"
        className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
};

const AdminLibraryPage = () => {
  const queryClient = useQueryClient();
  const [editingPhysicalId, setEditingPhysicalId] = useState('');
  const [editingDigitalId, setEditingDigitalId] = useState('');
  const [issueBookId, setIssueBookId] = useState('');
  const [isbnStatus, setIsbnStatus] = useState('');
  const [physicalPage, setPhysicalPage] = useState(1);
  const [digitalPage, setDigitalPage] = useState(1);
  const [programPage, setProgramPage] = useState(1);
  const [programModal, setProgramModal] = useState({ open: false, mode: 'add', id: '' });
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaModal, setMediaModal] = useState({ open: false, mode: 'add', id: '' });

  const physicalForm = useForm({ defaultValues: emptyPhysicalForm });
  const digitalForm = useForm({ defaultValues: emptyDigitalForm });
  const programForm = useForm({ defaultValues: emptyProgramForm });
  const issueForm = useForm({ defaultValues: emptyIssueForm });
  const mediaForm = useForm({ defaultValues: emptyMediaForm });

  const { data: libraryData } = useQuery({
    queryKey: ['library-content'],
    queryFn: () => libraryService.getLibraryData().then((res) => res.data)
  });

  const physicalBooks = useMemo(() => libraryData?.physicalBooks || [], [libraryData]);
  const digitalResources = useMemo(() => libraryData?.digitalResources || [], [libraryData]);
  const programUpdates = useMemo(() => libraryData?.programUpdates || [], [libraryData]);
  const mediaResources = useMemo(() => libraryData?.mediaResources || [], [libraryData]);

  const physicalTotalPages = Math.max(1, Math.ceil(physicalBooks.length / PAGE_SIZE));
  const digitalTotalPages = Math.max(1, Math.ceil(digitalResources.length / PAGE_SIZE));
  const programTotalPages = Math.max(1, Math.ceil(programUpdates.length / PAGE_SIZE));
  const mediaTotalPages = Math.max(1, Math.ceil(mediaResources.length / PAGE_SIZE));

  const visiblePhysicalBooks = useMemo(() => {
    const start = (physicalPage - 1) * PAGE_SIZE;
    return physicalBooks.slice(start, start + PAGE_SIZE);
  }, [physicalBooks, physicalPage]);

  const visibleDigitalResources = useMemo(() => {
    const start = (digitalPage - 1) * PAGE_SIZE;
    return digitalResources.slice(start, start + PAGE_SIZE);
  }, [digitalPage, digitalResources]);

  const visibleProgramUpdates = useMemo(() => {
    const start = (programPage - 1) * PAGE_SIZE;
    return programUpdates.slice(start, start + PAGE_SIZE);
  }, [programPage, programUpdates]);

  const visibleMediaResources = useMemo(() => {
    const start = (mediaPage - 1) * PAGE_SIZE;
    return mediaResources.slice(start, start + PAGE_SIZE);
  }, [mediaPage, mediaResources]);

  const selectedMediaResource = useMemo(
    () => mediaResources.find((entry) => entry.id === mediaModal.id) || null,
    [mediaModal.id, mediaResources]
  );

  const selectedPhysicalBook = useMemo(
    () => physicalBooks.find((book) => book.id === editingPhysicalId) || null,
    [editingPhysicalId, physicalBooks]
  );
  const selectedDigitalResource = useMemo(
    () => digitalResources.find((resource) => resource.id === editingDigitalId) || null,
    [digitalResources, editingDigitalId]
  );
  const selectedProgramUpdate = useMemo(
    () => programUpdates.find((entry) => entry.id === programModal.id) || null,
    [programModal.id, programUpdates]
  );

  const issueBook = useMemo(
    () => physicalBooks.find((book) => book.id === issueBookId) || null,
    [issueBookId, physicalBooks]
  );

  const activeIssueRecords = useMemo(() => (
    (issueBook?.issueRecords || []).filter((record) => !record.returnedAt)
  ), [issueBook]);

  const availableCopyNumbers = useMemo(() => {
    if (!issueBook) {
      return [];
    }

    const issuedCopies = new Set(activeIssueRecords.map((record) => record.copyNumber));
    return Array.from({ length: issueBook.totalCopies || 0 }, (_, index) => index + 1)
      .filter((copyNumber) => !issuedCopies.has(copyNumber));
  }, [activeIssueRecords, issueBook]);

  useEffect(() => {
    if (!selectedPhysicalBook) {
      physicalForm.reset(emptyPhysicalForm);
      setIsbnStatus('');
      return;
    }

    physicalForm.reset({
      title: selectedPhysicalBook.title || '',
      author: selectedPhysicalBook.author || '',
      category: selectedPhysicalBook.category || '',
      isbn: selectedPhysicalBook.isbn || '',
      totalCopies: selectedPhysicalBook.totalCopies || 1,
      notes: selectedPhysicalBook.notes || ''
    });
    setIsbnStatus('');
  }, [physicalForm, selectedPhysicalBook]);

  useEffect(() => {
    if (!selectedDigitalResource) {
      digitalForm.reset(emptyDigitalForm);
      return;
    }

    digitalForm.reset({
      title: selectedDigitalResource.title || '',
      fileType: selectedDigitalResource.fileType || 'PDF',
      description: selectedDigitalResource.description || '',
      downloadUrl: selectedDigitalResource.downloadUrl || '',
      coverImageUrl: selectedDigitalResource.coverImageUrl || '',
      tags: selectedDigitalResource.tags || ''
    });
  }, [digitalForm, selectedDigitalResource]);

  useEffect(() => {
    if (!programModal.open) {
      return;
    }

    if (programModal.mode === 'add') {
      programForm.reset(emptyProgramForm);
      return;
    }

    if (selectedProgramUpdate) {
      programForm.reset({
        title: selectedProgramUpdate.title || '',
        speaker: selectedProgramUpdate.speaker || '',
        audience: selectedProgramUpdate.audience || '',
        scheduleDate: selectedProgramUpdate.scheduleDate || '',
        scheduleTime: selectedProgramUpdate.scheduleTime || '',
        location: selectedProgramUpdate.location || '',
        summary: selectedProgramUpdate.summary || '',
        imageUrl: selectedProgramUpdate.imageUrl || '',
        registrationUrl: selectedProgramUpdate.registrationUrl || '/events'
      });
    }
  }, [programForm, programModal, selectedProgramUpdate]);

  const invalidateLibrary = () => queryClient.invalidateQueries({ queryKey: ['library-content'] });

  useEffect(() => {
    setPhysicalPage((prev) => Math.min(prev, physicalTotalPages));
  }, [physicalTotalPages]);

  useEffect(() => {
    setDigitalPage((prev) => Math.min(prev, digitalTotalPages));
  }, [digitalTotalPages]);

  useEffect(() => {
    setProgramPage((prev) => Math.min(prev, programTotalPages));
  }, [programTotalPages]);

  useEffect(() => {
    setMediaPage((prev) => Math.min(prev, mediaTotalPages));
  }, [mediaTotalPages]);

  useEffect(() => {
    if (!mediaModal.open) { return; }
    if (mediaModal.mode === 'add') { mediaForm.reset(emptyMediaForm); return; }
    if (selectedMediaResource) {
      mediaForm.reset({
        title: selectedMediaResource.title || '',
        mediaType: selectedMediaResource.mediaType || 'youtube',
        url: selectedMediaResource.url || '',
        description: selectedMediaResource.description || '',
        thumbnailUrl: selectedMediaResource.thumbnailUrl || '',
        tags: selectedMediaResource.tags || ''
      });
    }
  }, [mediaForm, mediaModal, selectedMediaResource]);

  useEffect(() => {
    if (!issueBook) {
      return;
    }

    issueForm.reset({
      ...emptyIssueForm,
      copyNumber: availableCopyNumbers[0] || 1,
      issueDate: new Date().toISOString().slice(0, 10)
    });
  }, [availableCopyNumbers, issueBook, issueForm]);

  const addPhysicalMutation = useMutation({
    mutationFn: (values) => libraryService.addPhysicalBook(values),
    onSuccess: () => {
      invalidateLibrary();
      setEditingPhysicalId('');
      physicalForm.reset(emptyPhysicalForm);
    }
  });

  const updatePhysicalMutation = useMutation({
    mutationFn: ({ id, values }) => libraryService.updatePhysicalBook(id, values),
    onSuccess: () => {
      invalidateLibrary();
      setEditingPhysicalId('');
      physicalForm.reset(emptyPhysicalForm);
    }
  });

  const deletePhysicalMutation = useMutation({
    mutationFn: (id) => libraryService.removePhysicalBook(id),
    onSuccess: () => {
      invalidateLibrary();
      if (editingPhysicalId) {
        setEditingPhysicalId('');
        physicalForm.reset(emptyPhysicalForm);
      }
    }
  });

  const lookupIsbnMutation = useMutation({
    mutationFn: (isbn) => libraryService.lookupBookByIsbn(isbn),
    onSuccess: (response) => {
      const payload = response?.data;
      if (!payload?.found) {
        setIsbnStatus('No ISBN match found. Please enter details manually.');
        return;
      }

      const details = payload.details || {};
      if (!physicalForm.getValues('title') && details.title) {
        physicalForm.setValue('title', details.title);
      }
      if (!physicalForm.getValues('author') && details.author) {
        physicalForm.setValue('author', details.author);
      }
      if (!physicalForm.getValues('category') && details.category) {
        physicalForm.setValue('category', details.category);
      }
      if (!physicalForm.getValues('notes') && details.notes) {
        physicalForm.setValue('notes', details.notes.slice(0, 600));
      }

      setIsbnStatus('Book details fetched from ISBN. You can still edit any field.');
    }
  });

  const addDigitalMutation = useMutation({
    mutationFn: (values) => libraryService.addDigitalResource(values),
    onSuccess: () => {
      invalidateLibrary();
      setEditingDigitalId('');
      digitalForm.reset(emptyDigitalForm);
    }
  });

  const updateDigitalMutation = useMutation({
    mutationFn: ({ id, values }) => libraryService.updateDigitalResource(id, values),
    onSuccess: () => {
      invalidateLibrary();
      setEditingDigitalId('');
      digitalForm.reset(emptyDigitalForm);
    }
  });

  const deleteDigitalMutation = useMutation({
    mutationFn: (id) => libraryService.removeDigitalResource(id),
    onSuccess: () => {
      invalidateLibrary();
      if (editingDigitalId) {
        setEditingDigitalId('');
        digitalForm.reset(emptyDigitalForm);
      }
    }
  });

  const addProgramMutation = useMutation({
    mutationFn: (values) => libraryService.addProgramUpdate(values),
    onSuccess: () => {
      invalidateLibrary();
      setProgramModal({ open: false, mode: 'add', id: '' });
      programForm.reset(emptyProgramForm);
    }
  });

  const updateProgramMutation = useMutation({
    mutationFn: ({ id, values }) => libraryService.updateProgramUpdate(id, values),
    onSuccess: () => {
      invalidateLibrary();
      setProgramModal({ open: false, mode: 'add', id: '' });
      programForm.reset(emptyProgramForm);
    }
  });

  const deleteProgramMutation = useMutation({
    mutationFn: (id) => libraryService.removeProgramUpdate(id),
    onSuccess: () => {
      invalidateLibrary();
    }
  });

  const addIssueMutation = useMutation({
    mutationFn: ({ bookId, values }) => libraryService.addIssueRecord(bookId, values),
    onSuccess: () => {
      invalidateLibrary();
      if (issueBook) {
        issueForm.reset({
          ...emptyIssueForm,
          copyNumber: availableCopyNumbers[0] || 1,
          issueDate: new Date().toISOString().slice(0, 10)
        });
      }
    }
  });

  const markIssueReturnedMutation = useMutation({
    mutationFn: ({ bookId, issueId }) => libraryService.markIssueReturned(bookId, issueId),
    onSuccess: () => invalidateLibrary()
  });

  const onSubmitPhysical = (values) => {
    if (editingPhysicalId) {
      updatePhysicalMutation.mutate({ id: editingPhysicalId, values });
      return;
    }

    addPhysicalMutation.mutate(values);
  };

  const onSubmitDigital = (values) => {
    if (editingDigitalId) {
      updateDigitalMutation.mutate({ id: editingDigitalId, values });
      return;
    }

    addDigitalMutation.mutate(values);
  };

  const onSubmitIssue = (values) => {
    if (!issueBook) {
      return;
    }
    addIssueMutation.mutate({ bookId: issueBook.id, values });
  };

  const exportLibraryRegistrations = async (book, format) => {
    const activeRecords = (book?.issueRecords || []).filter((record) => !record.returnedAt);
    if (activeRecords.length === 0) {
      return;
    }

    const rows = activeRecords.map((record) => [
      record.issuerName || '',
      record.issuerPhone || '',
      ''
    ]);

    const safeTitle = (book?.title || 'library-book')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const payload = {
      organizationName: siteConfig.name,
      serviceName: `Library: ${book?.title || 'Book Issue'}`,
      serviceDate: '-',
      serviceTime: '-',
      headers: ['Name', 'Number', 'Arrived'],
      rows
    };

    if (format === 'pdf') {
      await downloadRegistrationPdf({
        ...payload,
        fileName: `${safeTitle || 'library-book'}-registrations.pdf`
      });
      return;
    }

    downloadRegistrationCsv({
      ...payload,
      fileName: `${safeTitle || 'library-book'}-registrations.csv`
    });
  };

  const isSavingPhysical = addPhysicalMutation.isPending || updatePhysicalMutation.isPending;

  const addMediaMutation = useMutation({
    mutationFn: (values) => libraryService.addMediaResource(values),
    onSuccess: () => { invalidateLibrary(); setMediaModal({ open: false, mode: 'add', id: '' }); mediaForm.reset(emptyMediaForm); }
  });

  const updateMediaMutation = useMutation({
    mutationFn: ({ id, values }) => libraryService.updateMediaResource(id, values),
    onSuccess: () => { invalidateLibrary(); setMediaModal({ open: false, mode: 'add', id: '' }); mediaForm.reset(emptyMediaForm); }
  });

  const deleteMediaMutation = useMutation({
    mutationFn: (id) => libraryService.removeMediaResource(id),
    onSuccess: () => invalidateLibrary()
  });

  const isSavingMedia = addMediaMutation.isPending || updateMediaMutation.isPending;
  const isSavingDigital = addDigitalMutation.isPending || updateDigitalMutation.isPending;
  const isSavingProgram = addProgramMutation.isPending || updateProgramMutation.isPending;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Library Management</h1>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-semibold">Physical Books</h2>
            {editingPhysicalId ? (
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
                onClick={() => {
                  setEditingPhysicalId('');
                  physicalForm.reset(emptyPhysicalForm);
                }}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <form className="mt-4 grid gap-2.5 md:grid-cols-2" onSubmit={physicalForm.handleSubmit(onSubmitPhysical)}>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">ISBN
              <div className="mt-1 flex items-center gap-2">
                <input {...physicalForm.register('isbn')} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                <button
                  type="button"
                  className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-brand-blue text-brand-blue hover:bg-blue-50"
                  onClick={() => {
                    const isbnValue = physicalForm.getValues('isbn');
                    if (!isbnValue) {
                      setIsbnStatus('Enter ISBN first.');
                      return;
                    }
                    lookupIsbnMutation.mutate(isbnValue);
                  }}
                  aria-label="Fetch details using ISBN"
                  title="Fetch details using ISBN"
                >
                  {lookupIsbnMutation.isPending
                    ? <span className="text-[10px] font-semibold">...</span>
                    : <MagnifyingGlassIcon className="h-4 w-4" />}
                </button>
              </div>
              {isbnStatus ? <p className="mt-1 text-[11px] text-slate-500">{isbnStatus}</p> : null}
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Book Title
              <input {...physicalForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Author
              <input {...physicalForm.register('author')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Category
              <input {...physicalForm.register('category')} placeholder="History, Gurbani..." className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total Copies
              <input type="number" min="0" {...physicalForm.register('totalCopies', { valueAsNumber: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Notes
              <textarea rows={2} {...physicalForm.register('notes')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>

            <div className="md:col-span-2">
              <Button type="submit" disabled={isSavingPhysical}>
                {isSavingPhysical ? 'Saving...' : (editingPhysicalId ? 'Update Physical Book' : 'Add Physical Book')}
              </Button>
            </div>
          </form>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-1.5">Title</th>
                  <th className="px-3 py-1.5">Copies</th>
                  <th className="px-3 py-1.5">Issued</th>
                  <th className="px-3 py-1.5">Available</th>
                  <th className="px-3 py-1.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visiblePhysicalBooks.map((book) => {
                  const available = Math.max(0, (book.totalCopies || 0) - (book.issuedCopies || 0));
                  return (
                    <tr key={book.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-1.5">
                        <p className="font-semibold text-slate-800">{book.title || 'Untitled'}</p>
                        <p className="text-xs text-slate-500">{book.author || 'Unknown author'}</p>
                      </td>
                      <td className="px-3 py-1.5">{book.totalCopies || 0}</td>
                      <td className="px-3 py-1.5">{book.issuedCopies || 0}</td>
                      <td className="px-3 py-1.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{available}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                            title="Edit"
                            aria-label="Edit"
                            onClick={() => setEditingPhysicalId(book.id)}
                          >
                            <PencilSquareIcon className={actionIconClass} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 items-center justify-center rounded border border-slate-300 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            title="Issues"
                            onClick={() => setIssueBookId(book.id)}
                          >
                            Issues
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 items-center justify-center rounded border border-indigo-200 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Download CSV"
                            aria-label="Download CSV"
                            onClick={() => exportLibraryRegistrations(book, 'csv')}
                            disabled={(book.issueRecords || []).filter((record) => !record.returnedAt).length === 0}
                          >
                            CSV
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 items-center justify-center rounded border border-indigo-200 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Download PDF"
                            aria-label="Download PDF"
                            onClick={() => exportLibraryRegistrations(book, 'pdf')}
                            disabled={(book.issueRecords || []).filter((record) => !record.returnedAt).length === 0}
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-700 hover:bg-red-50"
                            title="Delete"
                            aria-label="Delete"
                            onClick={() => deletePhysicalMutation.mutate(book.id)}
                          >
                            <TrashIcon className={actionIconClass} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {physicalBooks.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-center text-sm text-slate-500" colSpan={5}>No physical books yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pagination page={physicalPage} total={physicalTotalPages} onChange={setPhysicalPage} />
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-semibold">Digital Resources</h2>
            {editingDigitalId ? (
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
                onClick={() => {
                  setEditingDigitalId('');
                  digitalForm.reset(emptyDigitalForm);
                }}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <form className="mt-4 grid gap-2.5 md:grid-cols-2" onSubmit={digitalForm.handleSubmit(onSubmitDigital)}>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Resource Title
              <input {...digitalForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Type
              <select {...digitalForm.register('fileType')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                <option>PDF</option>
                <option>DOC</option>
                <option>DOCX</option>
                <option>PPT</option>
                <option>LINK</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Description
              <textarea rows={2} {...digitalForm.register('description')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Download Link
              <input {...digitalForm.register('downloadUrl', { required: true })} placeholder="https://example.com/file.pdf" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Cover Image Link
              <input {...digitalForm.register('coverImageUrl')} placeholder="https://example.com/cover.jpg" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Tags
              <input {...digitalForm.register('tags')} placeholder="history, katha, youth" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>

            <div className="md:col-span-2">
              <Button type="submit" disabled={isSavingDigital}>
                {isSavingDigital ? 'Saving...' : (editingDigitalId ? 'Update Digital Resource' : 'Add Digital Resource')}
              </Button>
            </div>
          </form>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-1.5">Title</th>
                  <th className="px-3 py-1.5">Type</th>
                  <th className="px-3 py-1.5">Download</th>
                  <th className="px-3 py-1.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDigitalResources.map((resource) => (
                  <tr key={resource.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {resource.coverImageUrl ? (
                          <img src={resource.coverImageUrl} alt={resource.title || 'Cover'} className="h-9 w-7 rounded object-cover" />
                        ) : (
                          <div className="h-9 w-7 rounded bg-slate-200" />
                        )}
                        <div>
                          <p className="font-semibold text-slate-800">{resource.title || 'Untitled resource'}</p>
                          <p className="text-xs text-slate-500">{resource.tags || 'No tags'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">{resource.fileType || 'PDF'}</td>
                    <td className="px-3 py-1.5">
                      <a className="text-xs font-semibold text-brand-blue hover:underline" href={resource.downloadUrl} target="_blank" rel="noreferrer">Open Link</a>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                          title="Edit"
                          aria-label="Edit"
                          onClick={() => setEditingDigitalId(resource.id)}
                        >
                          <PencilSquareIcon className={actionIconClass} />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-700 hover:bg-red-50"
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => deleteDigitalMutation.mutate(resource.id)}
                        >
                          <TrashIcon className={actionIconClass} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {digitalResources.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-center text-sm text-slate-500" colSpan={4}>No downloadable resources yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pagination page={digitalPage} total={digitalTotalPages} onChange={setDigitalPage} />
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold">Library Reading Sessions and Highlights</h2>
            <p className="mt-1 text-xs text-slate-600">Add public updates like author sessions, kids reading circles, and special library events.</p>
          </div>
          <Button type="button" onClick={() => setProgramModal({ open: true, mode: 'add', id: '' })}>Add Library Session</Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-1.5">Title</th>
                <th className="px-3 py-1.5">Date</th>
                <th className="px-3 py-1.5">Audience</th>
                <th className="px-3 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProgramUpdates.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-1.5">
                    <p className="font-semibold text-slate-800">{entry.title}</p>
                    <p className="text-xs text-slate-500">{entry.speaker || 'Guest Speaker TBD'}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${entry.eventId ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {entry.eventId ? 'Linked to Events' : 'Not Linked'}
                      </span>
                      {entry.eventId ? (
                        <a href={`/events?eventId=${entry.eventId}`} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-brand-blue hover:underline">
                          Open Event
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">{entry.scheduleDate || '-'} {entry.scheduleTime ? `| ${entry.scheduleTime}` : ''}</td>
                  <td className="px-3 py-1.5">{entry.audience || '-'}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                        onClick={() => setProgramModal({ open: true, mode: 'view', id: entry.id })}
                        title="View"
                        aria-label="View"
                      >
                        <EyeIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => setProgramModal({ open: true, mode: 'edit', id: entry.id })}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <PencilSquareIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => deleteProgramMutation.mutate(entry.id)}
                        title="Delete"
                        aria-label="Delete"
                      >
                        <TrashIcon className={actionIconClass} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {programUpdates.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-center text-sm text-slate-500" colSpan={4}>No library updates yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination page={programPage} total={programTotalPages} onChange={setProgramPage} />
      </Card>

      {programModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" aria-hidden="true" onClick={() => setProgramModal({ open: false, mode: 'add', id: '' })} />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold">
                {programModal.mode === 'add' ? 'Add Library Session' : (programModal.mode === 'edit' ? 'Edit Library Session' : 'Session Details')}
              </h3>
              <button
                type="button"
                onClick={() => setProgramModal({ open: false, mode: 'add', id: '' })}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close session modal"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form
              className="mt-4 grid gap-2.5 md:grid-cols-3"
              onSubmit={programForm.handleSubmit((values) => {
                if (programModal.mode === 'edit' && programModal.id) {
                  updateProgramMutation.mutate({ id: programModal.id, values });
                  return;
                }
                addProgramMutation.mutate(values);
              })}
            >
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Title
                <input disabled={programModal.mode === 'view'} {...programForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Speaker
                <input disabled={programModal.mode === 'view'} {...programForm.register('speaker')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Audience
                <input disabled={programModal.mode === 'view'} {...programForm.register('audience')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Date
                <input disabled={programModal.mode === 'view'} type="date" {...programForm.register('scheduleDate')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Time
                <input disabled={programModal.mode === 'view'} {...programForm.register('scheduleTime')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Location
                <input disabled={programModal.mode === 'view'} {...programForm.register('location')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Registration URL
                <input disabled={programModal.mode === 'view'} {...programForm.register('registrationUrl')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Image URL
                <input disabled={programModal.mode === 'view'} {...programForm.register('imageUrl')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-3">Summary
                <textarea disabled={programModal.mode === 'view'} rows={2} {...programForm.register('summary')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <div className="md:col-span-3 flex gap-2">
                {programModal.mode === 'view' ? null : (
                  <Button type="submit" disabled={isSavingProgram}>
                    {isSavingProgram ? 'Saving...' : (programModal.mode === 'edit' ? 'Update Library Session' : 'Add Library Session')}
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => setProgramModal({ open: false, mode: 'add', id: '' })}>Close</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {issueBook ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" aria-hidden="true" onClick={() => setIssueBookId('')} />
          <div className="relative z-10 w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-semibold">Issue Tracking: {issueBook.title}</h3>
                <p className="text-xs text-slate-600">Track issuer name, phone, issue date, and expected return date.</p>
              </div>
              <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" onClick={() => setIssueBookId('')}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-4 grid gap-2.5 md:grid-cols-5" onSubmit={issueForm.handleSubmit(onSubmitIssue)}>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Copy
                <select {...issueForm.register('copyNumber', { valueAsNumber: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" disabled={availableCopyNumbers.length === 0}>
                  {availableCopyNumbers.map((copyNumber) => (
                    <option key={copyNumber} value={copyNumber}>Copy {copyNumber}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Issuer Name
                <input {...issueForm.register('issuerName', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" disabled={availableCopyNumbers.length === 0} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Phone
                <input {...issueForm.register('issuerPhone')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" disabled={availableCopyNumbers.length === 0} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Issue Date
                <input type="date" {...issueForm.register('issueDate', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" disabled={availableCopyNumbers.length === 0} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Return Date
                <input type="date" {...issueForm.register('returnDate', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" disabled={availableCopyNumbers.length === 0} />
              </label>

              <div className="md:col-span-5">
                <Button type="submit" disabled={availableCopyNumbers.length === 0 || addIssueMutation.isPending}>
                  {addIssueMutation.isPending ? 'Saving...' : 'Add Issue Record'}
                </Button>
                {availableCopyNumbers.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-700">All copies are currently issued. Mark one as returned before issuing again.</p>
                ) : null}
              </div>
            </form>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-1.5">Copy</th>
                    <th className="px-3 py-1.5">Issuer</th>
                    <th className="px-3 py-1.5">Phone</th>
                    <th className="px-3 py-1.5">Issued</th>
                    <th className="px-3 py-1.5">Return</th>
                    <th className="px-3 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(issueBook.issueRecords || []).map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-1.5">Copy {record.copyNumber}</td>
                      <td className="px-3 py-1.5">{record.issuerName || '-'}</td>
                      <td className="px-3 py-1.5">{record.issuerPhone || '-'}</td>
                      <td className="px-3 py-1.5">{record.issueDate || '-'}</td>
                      <td className="px-3 py-1.5">{record.returnDate || '-'}</td>
                      <td className="px-3 py-1.5">
                        {record.returnedAt ? (
                          <span className="text-xs font-semibold text-slate-500">Returned {record.returnedAt}</span>
                        ) : (
                          <button
                            type="button"
                            className="rounded border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            onClick={() => markIssueReturnedMutation.mutate({ bookId: issueBook.id, issueId: record.id })}
                          >
                            Mark Returned
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(issueBook.issueRecords || []).length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-center text-sm text-slate-500" colSpan={6}>No issue records yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold">Media Resources</h2>
            <p className="mt-1 text-xs text-slate-600">Add YouTube videos, audio links, or playlists to enrich library learning on Sikhism.</p>
          </div>
          <Button type="button" onClick={() => setMediaModal({ open: true, mode: 'add', id: '' })}>Add Media</Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-1.5">Title</th>
                <th className="px-3 py-1.5">Type</th>
                <th className="px-3 py-1.5">Tags</th>
                <th className="px-3 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleMediaResources.map((entry) => {
                const thumb = entry.thumbnailUrl || (entry.mediaType === 'youtube' ? getYouTubeThumbnail(entry.url) : '');
                return (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {thumb ? <img src={thumb} alt={entry.title} className="h-9 w-16 rounded object-cover" /> : <div className="h-9 w-16 rounded bg-slate-200" />}
                        <p className="font-semibold text-slate-800">{entry.title || 'Untitled'}</p>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 capitalize">{entry.mediaType}</td>
                    <td className="px-3 py-1.5">{entry.tags || '-'}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100" title="View" onClick={() => setMediaModal({ open: true, mode: 'view', id: entry.id })}><EyeIcon className={actionIconClass} /></button>
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded border border-blue-200 text-blue-700 hover:bg-blue-50" title="Edit" onClick={() => setMediaModal({ open: true, mode: 'edit', id: entry.id })}><PencilSquareIcon className={actionIconClass} /></button>
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-700 hover:bg-red-50" title="Delete" onClick={() => deleteMediaMutation.mutate(entry.id)}><TrashIcon className={actionIconClass} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {mediaResources.length === 0 ? (
                <tr><td className="px-3 py-3 text-center text-sm text-slate-500" colSpan={4}>No media resources yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination page={mediaPage} total={mediaTotalPages} onChange={setMediaPage} />
      </Card>

      {mediaModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" aria-hidden="true" onClick={() => setMediaModal({ open: false, mode: 'add', id: '' })} />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold">
                {mediaModal.mode === 'add' ? 'Add Media Resource' : mediaModal.mode === 'edit' ? 'Edit Media Resource' : 'Media Details'}
              </h3>
              <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" onClick={() => setMediaModal({ open: false, mode: 'add', id: '' })}><XMarkIcon className="h-5 w-5" /></button>
            </div>

            {mediaModal.mode === 'view' && selectedMediaResource ? (
              <div className="mt-4 space-y-3">
                {selectedMediaResource.mediaType === 'youtube' && getYouTubeEmbedUrl(selectedMediaResource.url) ? (
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
                    <iframe className="h-full w-full" src={getYouTubeEmbedUrl(selectedMediaResource.url)} title={selectedMediaResource.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <a href={selectedMediaResource.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Open Media Link →</a>
                )}
                <div className="grid gap-1.5 text-sm text-slate-700 md:grid-cols-2">
                  <p><span className="font-semibold">Type:</span> {selectedMediaResource.mediaType}</p>
                  <p><span className="font-semibold">Tags:</span> {selectedMediaResource.tags || '-'}</p>
                  {selectedMediaResource.description ? <p className="md:col-span-2">{selectedMediaResource.description}</p> : null}
                </div>
                <div className="flex justify-end"><Button type="button" variant="ghost" onClick={() => setMediaModal({ open: false, mode: 'add', id: '' })}>Close</Button></div>
              </div>
            ) : (
              <form
                className="mt-4 grid gap-2.5 md:grid-cols-2"
                onSubmit={mediaForm.handleSubmit((values) => {
                  if (mediaModal.mode === 'edit' && mediaModal.id) {
                    updateMediaMutation.mutate({ id: mediaModal.id, values });
                    return;
                  }
                  addMediaMutation.mutate(values);
                })}
              >
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Type
                  <select {...mediaForm.register('mediaType')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                    <option value="youtube">YouTube Video</option>
                    <option value="youtube_playlist">YouTube Playlist</option>
                    <option value="audio">Audio Link</option>
                    <option value="other">Other Link</option>
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Title
                  <input {...mediaForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">URL
                  <input {...mediaForm.register('url', { required: true })} placeholder="https://www.youtube.com/watch?v=..." className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Thumbnail Image URL (optional)
                  <input {...mediaForm.register('thumbnailUrl')} placeholder="Leave blank to auto-fetch from YouTube" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Tags
                  <input {...mediaForm.register('tags')} placeholder="japji, katha, sikhism" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-2">Description
                  <textarea rows={2} {...mediaForm.register('description')} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                </label>
                <div className="md:col-span-2 flex gap-2">
                  <Button type="submit" disabled={isSavingMedia}>{isSavingMedia ? 'Saving...' : (mediaModal.mode === 'edit' ? 'Update Media' : 'Add Media')}</Button>
                  <Button type="button" variant="ghost" onClick={() => setMediaModal({ open: false, mode: 'add', id: '' })}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminLibraryPage;
