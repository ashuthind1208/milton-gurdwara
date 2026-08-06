import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import cmsService from '../../services/cmsService';
import uploadService from '../../services/uploadService';
import StatusAlert from '../../components/common/StatusAlert';
import PhoneInput from '../../components/forms/PhoneInput';
import RichTextEditor from '../../components/forms/RichTextEditor';
import { isTenDigitPhone, TEN_DIGIT_PHONE_ERROR } from '../../utils/phone';

const emptySlide = {
  image: '',
  eyebrow: '',
  title: '',
  description: '',
  order: 1,
  primaryCtaLabel: '',
  primaryCtaPath: '',
  secondaryCtaLabel: '',
  secondaryCtaPath: '',
  contentLinkLabel: '',
  contentLinkPath: '',
  contentLinkTwoLabel: '',
  contentLinkTwoPath: ''
};

const emptySection = {
  title: '',
  body: '',
  mediaUrl: ''
};

const pageOptions = [
  { value: 'about', label: 'About Us' },
  { value: 'sikhism', label: 'Sikhism' },
  { value: 'events', label: 'Events' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'contact', label: 'Contact' }
];

const isImageUrl = (value = '') => /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(String(value || ''));

const AdminCmsPage = () => {
  const queryClient = useQueryClient();
  const [selectedPage, setSelectedPage] = useState('about');
  const [slideModal, setSlideModal] = useState({ open: false, mode: 'view', slideId: null });
  const [sectionModal, setSectionModal] = useState({ open: false, mode: 'view', sectionId: null });
  const [pageUploadPending, setPageUploadPending] = useState(false);
  const [slideUploadPending, setSlideUploadPending] = useState(false);
  const [sectionUploadPending, setSectionUploadPending] = useState(false);
  const [pageUploadProgress, setPageUploadProgress] = useState(0);
  const [slideUploadProgress, setSlideUploadProgress] = useState(0);
  const [sectionUploadProgress, setSectionUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({ type: 'success', message: '' });
  const [introHtml, setIntroHtml] = useState('');
  const [sectionBodyHtml, setSectionBodyHtml] = useState('');

  const slideForm = useForm({ defaultValues: emptySlide });
  const pageForm = useForm({
    defaultValues: {
      heroTitle: '',
      heroDescription: '',
      intro: '',
      mediaUrl: '',
      phone: '',
      email: '',
      address: '',
      mapEmbedUrl: ''
    }
  });
  const sectionForm = useForm({ defaultValues: emptySection });

  const { data: slides = [] } = useQuery({
    queryKey: ['hero-slides'],
    queryFn: () => cmsService.getHeroSlides().then((res) => res.data)
  });

  const { data: pageData } = useQuery({
    queryKey: ['page-content-admin', selectedPage],
    queryFn: () => cmsService.getPageContent(selectedPage).then((res) => res.data)
  });

  useEffect(() => {
    if (!pageData) {
      return;
    }

    pageForm.reset({
      heroTitle: pageData.heroTitle || '',
      heroDescription: pageData.heroDescription || '',
      intro: pageData.intro || '',
      mediaUrl: pageData.mediaUrl || '',
      phone: pageData.phone || '',
      email: pageData.email || '',
      address: pageData.address || '',
      mapEmbedUrl: pageData.mapEmbedUrl || ''
    });
    setIntroHtml(pageData.intro || '');
  }, [pageData, pageForm]);

  const selectedSlide = useMemo(() => slides.find((slide) => slide.id === slideModal.slideId), [slides, slideModal.slideId]);
  const sections = useMemo(() => pageData?.sections || [], [pageData]);
  const selectedSection = useMemo(() => sections.find((section) => section.id === sectionModal.sectionId), [sections, sectionModal.sectionId]);

  useEffect(() => {
    if (!slideModal.open) {
      return;
    }

    if (slideModal.mode === 'add') {
      slideForm.reset({ ...emptySlide, order: slides.length + 1 });
      return;
    }

    if (selectedSlide) {
      slideForm.reset({
        ...emptySlide,
        ...selectedSlide,
        order: selectedSlide.order || 1
      });
    }
  }, [selectedSlide, slideForm, slideModal, slides.length]);

  useEffect(() => {
    if (!sectionModal.open) {
      return;
    }

    if (sectionModal.mode === 'add') {
      sectionForm.reset(emptySection);
      setSectionBodyHtml('');
      return;
    }

    if (selectedSection) {
      sectionForm.reset({
        title: selectedSection.title || '',
        body: selectedSection.body || '',
        mediaUrl: selectedSection.mediaUrl || ''
      });
      setSectionBodyHtml(selectedSection.body || '');
    }
  }, [sectionForm, sectionModal, selectedSection]);

  const addSlideMutation = useMutation({
    mutationFn: (values) => cmsService.addHeroSlide(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] });
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
      setSlideModal({ open: false, mode: 'view', slideId: null });
    }
  });

  const updateSlideMutation = useMutation({
    mutationFn: ({ id, values }) => cmsService.updateHeroSlide(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] });
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
      setSlideModal({ open: false, mode: 'view', slideId: null });
    }
  });

  const deleteSlideMutation = useMutation({
    mutationFn: (id) => cmsService.removeHeroSlide(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] });
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
    }
  });

  const savePageBasicsMutation = useMutation({
    mutationFn: (values) => cmsService.updatePageContent(selectedPage, { ...pageData, ...values, intro: introHtml, sections }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-content-admin', selectedPage] });
      queryClient.invalidateQueries({ queryKey: ['page-content', selectedPage] });
      window.alert('Page details updated successfully.');
    }
  });

  const saveSectionsMutation = useMutation({
    mutationFn: (nextSections) => cmsService.updatePageContent(selectedPage, {
      ...pageData,
      sections: nextSections
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-content-admin', selectedPage] });
      queryClient.invalidateQueries({ queryKey: ['page-content', selectedPage] });
      setSectionModal({ open: false, mode: 'view', sectionId: null });
    }
  });

  const onSlideSubmit = (values) => {
    if (slideModal.mode === 'add') {
      addSlideMutation.mutate(values);
      return;
    }

    if (selectedSlide) {
      updateSlideMutation.mutate({ id: selectedSlide.id, values });
    }
  };

  const onSectionSubmit = (values) => {
    if (sectionModal.mode === 'add') {
      saveSectionsMutation.mutate([
        ...sections,
        { id: `section-${Date.now()}`, ...values, body: sectionBodyHtml }
      ]);
      return;
    }

    if (selectedSection) {
      saveSectionsMutation.mutate(
        sections.map((section) => (section.id === selectedSection.id ? { ...section, ...values, body: sectionBodyHtml } : section))
      );
    }
  };

  const uploadCmsFile = async ({ file, target }) => {
    if (!file) {
      return;
    }

    try {
      if (target === 'page') {
        setPageUploadPending(true);
        setPageUploadProgress(0);
      }
      if (target === 'slide') {
        setSlideUploadPending(true);
        setSlideUploadProgress(0);
      }
      if (target === 'section') {
        setSectionUploadPending(true);
        setSectionUploadProgress(0);
      }

      const uploaded = await uploadService.uploadFile({
        service: 'cms',
        file,
        allowedMimeTypes: ['image/*', 'video/*', 'application/pdf'],
        maxSizeMB: 15,
        onProgress: (percent) => {
          if (target === 'page') {
            setPageUploadProgress(percent);
            return;
          }
          if (target === 'slide') {
            setSlideUploadProgress(percent);
            return;
          }
          setSectionUploadProgress(percent);
        }
      });
      const nextUrl = uploaded?.url || '';
      if (!nextUrl) {
        throw new Error('Upload did not return a file URL.');
      }

      if (target === 'page') {
        pageForm.setValue('mediaUrl', nextUrl, { shouldDirty: true, shouldValidate: true });
      }
      if (target === 'slide') {
        slideForm.setValue('image', nextUrl, { shouldDirty: true, shouldValidate: true });
      }
      if (target === 'section') {
        sectionForm.setValue('mediaUrl', nextUrl, { shouldDirty: true, shouldValidate: true });
      }
      setUploadStatus({ type: 'success', message: 'File uploaded successfully.' });
    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message || 'Unable to upload file.' });
    } finally {
      if (target === 'page') {
        setPageUploadPending(false);
        setPageUploadProgress(0);
      }
      if (target === 'slide') {
        setSlideUploadPending(false);
        setSlideUploadProgress(0);
      }
      if (target === 'section') {
        setSectionUploadPending(false);
        setSectionUploadProgress(0);
      }
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="sr-only">CMS Management</h1>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold">Hero Slides</h2>
            <p className="mt-1 text-sm text-slate-600">Slides are managed as a table with modal view/edit/add.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setSlideModal({ open: true, mode: 'add', slideId: null })}>Add New Slide</Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Eyebrow</th>
                <th className="px-3 py-2">Primary CTA</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slides.map((slide) => (
                <tr key={slide.id}>
                  <td className="px-3 py-2 font-semibold text-brand-blue">#{slide.order}</td>
                  <td className="px-3 py-2">{slide.title || 'Untitled slide'}</td>
                  <td className="px-3 py-2">{slide.eyebrow || '-'}</td>
                  <td className="px-3 py-2">{slide.primaryCtaLabel || '-'} {slide.primaryCtaPath ? `(${slide.primaryCtaPath})` : ''}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold" onClick={() => setSlideModal({ open: true, mode: 'view', slideId: slide.id })}>View</button>
                      <button type="button" className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold" onClick={() => setSlideModal({ open: true, mode: 'edit', slideId: slide.id })}>Edit</button>
                      <button type="button" className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700" onClick={() => deleteSlideMutation.mutate(slide.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold">Page Content</h2>
            <p className="mt-1 text-sm text-slate-600">Select page first, then manage details and section rows.</p>
          </div>
          <label className="text-sm font-medium">
            Page
            <select value={selectedPage} onChange={(event) => setSelectedPage(event.target.value)} className="ml-2 rounded-lg border border-slate-300 p-2 text-sm">
              {pageOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <form className="mt-4 space-y-4" onSubmit={pageForm.handleSubmit((values) => savePageBasicsMutation.mutate(values))}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
            </div>
            <label className="text-sm">Hero Title
              <input {...pageForm.register('heroTitle')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            <label className="text-sm">Media Link
              <input {...pageForm.register('mediaUrl')} placeholder="https://example.com/media.jpg" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              <input
                type="file"
                accept="image/*,video/*,application/pdf"
                className="mt-2 block w-full text-xs"
                onChange={(event) => uploadCmsFile({ file: event.target.files?.[0], target: 'page' })}
              />
              <p className="mt-1 text-xs text-slate-500">{pageUploadPending ? `Uploading media... ${pageUploadProgress}%` : 'Paste URL or upload file (image/video/pdf, max 15MB).'}</p>
              {pageUploadPending ? (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-brand-blue transition-all" style={{ width: `${pageUploadProgress}%` }} />
                </div>
              ) : null}
              {isImageUrl(pageForm.watch('mediaUrl')) ? (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <img src={pageForm.watch('mediaUrl')} alt="Page media preview" className="h-36 w-full object-contain" loading="lazy" />
                </div>
              ) : null}
            </label>
            <label className="text-sm md:col-span-2">Hero Description
              <textarea {...pageForm.register('heroDescription')} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            <label className="text-sm md:col-span-2">Intro Text
              <div className="mt-1">
                <RichTextEditor value={introHtml} onChange={setIntroHtml} minHeight={120} />
              </div>
            </label>
            {selectedPage === 'contact' ? (
              <>
                <label className="text-sm">Phone
                  <PhoneInput {...pageForm.register('phone', { validate: (value) => !value || isTenDigitPhone(value) || TEN_DIGIT_PHONE_ERROR })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm">Email
                  <input {...pageForm.register('email')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm md:col-span-2">Address
                  <input {...pageForm.register('address')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm md:col-span-2">Map Embed Link
                  <input {...pageForm.register('mapEmbedUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                </label>
              </>
            ) : null}
          </div>
          <Button type="submit" disabled={savePageBasicsMutation.isPending}>{savePageBasicsMutation.isPending ? 'Saving...' : 'Save Page Details'}</Button>
        </form>

        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-heading text-lg font-semibold">Sections</h3>
            <button type="button" className="rounded-lg bg-brand-saffron px-3 py-1 text-xs font-semibold text-black" onClick={() => setSectionModal({ open: true, mode: 'add', sectionId: null })}>Add Section</button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Body Preview</th>
                  <th className="px-3 py-2">Media</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sections.map((section) => (
                  <tr key={section.id}>
                    <td className="px-3 py-2">{section.title || 'Untitled section'}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-slate-500 text-xs">{(section.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)}{(section.body || '').replace(/<[^>]+>/g, '').trim().length > 90 ? '...' : ''}</td>
                    <td className="px-3 py-2">
                      {section.mediaUrl ? (
                        isImageUrl(section.mediaUrl) ? (
                          <div className="h-16 w-24 overflow-hidden rounded border border-slate-200 bg-slate-50">
                            <img src={section.mediaUrl} alt={section.title || 'Section media'} className="h-full w-full object-contain" loading="lazy" />
                          </div>
                        ) : (
                          <a className="text-xs font-semibold text-brand-blue hover:underline" href={section.mediaUrl} target="_blank" rel="noreferrer">Open file</a>
                        )
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button type="button" className="rounded-md border border-slate-300 p-1.5 text-slate-700" onClick={() => setSectionModal({ open: true, mode: 'view', sectionId: section.id })} title="View">
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded-md border border-slate-300 p-1.5 text-slate-700" onClick={() => setSectionModal({ open: true, mode: 'edit', sectionId: section.id })} title="Edit">
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded-md border border-red-200 p-1.5 text-red-700" onClick={() => saveSectionsMutation.mutate(sections.filter((item) => item.id !== section.id))} title="Delete">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {slideModal.open ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">{slideModal.mode === 'add' ? 'Add New Slide' : slideModal.mode === 'edit' ? 'Edit Slide' : 'View Slide'}</h3>
              <button type="button" onClick={() => setSlideModal({ open: false, mode: 'view', slideId: null })} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>

            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={slideForm.handleSubmit(onSlideSubmit)}>
              <div className="md:col-span-2">
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              </div>
              <label className="text-sm">Slide Order
                <input type="number" min="1" max={Math.max(1, slides.length + (slideModal.mode === 'add' ? 1 : 0))} disabled={slideModal.mode === 'view'} {...slideForm.register('order', { valueAsNumber: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Image URL
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('image')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
                {slideModal.mode !== 'view' ? (
                  <>
                    <input
                      type="file"
                      accept="image/*,video/*,application/pdf"
                      className="mt-2 block w-full text-xs"
                      onChange={(event) => uploadCmsFile({ file: event.target.files?.[0], target: 'slide' })}
                    />
                    <p className="mt-1 text-xs text-slate-500">{slideUploadPending ? `Uploading slide media... ${slideUploadProgress}%` : 'Paste URL or upload file (image/video/pdf, max 15MB).'}</p>
                    {slideUploadPending ? (
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-brand-blue transition-all" style={{ width: `${slideUploadProgress}%` }} />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </label>
              <label className="text-sm">Eyebrow
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('eyebrow')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Title
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('title')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm md:col-span-2">Description
                <textarea rows={3} disabled={slideModal.mode === 'view'} {...slideForm.register('description')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Primary CTA Label
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('primaryCtaLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Primary CTA Path
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('primaryCtaPath')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Secondary CTA Label
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('secondaryCtaLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Secondary CTA Path
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('secondaryCtaPath')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Content Link One Label
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('contentLinkLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Content Link One Path
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('contentLinkPath')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Content Link Two Label
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('contentLinkTwoLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Content Link Two Path
                <input disabled={slideModal.mode === 'view'} {...slideForm.register('contentLinkTwoPath')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              {slideModal.mode !== 'view' ? (
                <div className="md:col-span-2 flex gap-2">
                  <Button type="submit" disabled={addSlideMutation.isPending || updateSlideMutation.isPending}>{addSlideMutation.isPending || updateSlideMutation.isPending ? 'Saving...' : 'Save Slide'}</Button>
                  <button type="button" onClick={() => setSlideModal({ open: false, mode: 'view', slideId: null })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
                </div>
              ) : null}
            </form>
          </div>
          </div>
        </div>
      ) : null}

      {sectionModal.open ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">{sectionModal.mode === 'add' ? 'Add Section' : sectionModal.mode === 'edit' ? 'Edit Section' : 'View Section'}</h3>
              <button type="button" onClick={() => setSectionModal({ open: false, mode: 'view', sectionId: null })} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={sectionForm.handleSubmit(onSectionSubmit)}>
              <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              <label className="text-sm">Section Title
                <input disabled={sectionModal.mode === 'view'} {...sectionForm.register('title')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
              </label>
              <label className="text-sm">Section Media Link
                <input disabled={sectionModal.mode === 'view'} {...sectionForm.register('mediaUrl')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
                {sectionModal.mode !== 'view' ? (
                  <>
                    <input
                      type="file"
                      accept="image/*,video/*,application/pdf"
                      className="mt-2 block w-full text-xs"
                      onChange={(event) => uploadCmsFile({ file: event.target.files?.[0], target: 'section' })}
                    />
                    <p className="mt-1 text-xs text-slate-500">{sectionUploadPending ? `Uploading section media... ${sectionUploadProgress}%` : 'Paste URL or upload file (image/video/pdf, max 15MB).'}</p>
                    {sectionUploadPending ? (
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-brand-blue transition-all" style={{ width: `${sectionUploadProgress}%` }} />
                      </div>
                    ) : null}
                  </>
                ) : null}
                {isImageUrl(sectionForm.watch('mediaUrl')) ? (
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <img src={sectionForm.watch('mediaUrl')} alt="Section media preview" className="h-40 w-full object-contain" loading="lazy" />
                  </div>
                ) : null}
              </label>
              <div className="text-sm">
                <p className="mb-1 font-medium">Section Body</p>
                {sectionModal.mode === 'view' ? (
                  <div className="min-h-[120px] rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm" dangerouslySetInnerHTML={{ __html: sectionBodyHtml || '<em class="text-slate-400">No content</em>' }} />
                ) : (
                  <RichTextEditor value={sectionBodyHtml} onChange={setSectionBodyHtml} minHeight={180} />
                )}
              </div>

              {sectionModal.mode !== 'view' ? (
                <div className="flex gap-2">
                  <Button type="submit" disabled={saveSectionsMutation.isPending}>{saveSectionsMutation.isPending ? 'Saving...' : 'Save Section'}</Button>
                  <button type="button" onClick={() => setSectionModal({ open: false, mode: 'view', sectionId: null })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
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

export default AdminCmsPage;
