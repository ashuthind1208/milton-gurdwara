import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, MegaphoneIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { COMMUNITY_ANNOUNCEMENT_CATEGORIES, COMMUNITY_ANNOUNCEMENT_CATEGORY_LABELS } from '../../constants/communityAnnouncements';
import communityAnnouncementService from '../../services/communityAnnouncementService';
import uploadService from '../../services/uploadService';

const toDateInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => toDateInputValue(new Date());
const defaultEndDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return toDateInputValue(date);
};
const fieldClass = 'mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15';
const emptyForm = () => ({
  noticeFormat: 'text', titleEnglish: '', titlePunjabi: '', descriptionEnglish: '', descriptionPunjabi: '', category: 'community-service',
  audience: 'sangat', contactPreference: 'none', contactValue: '', imageUrl: '', publishFrom: today(), publishUntil: defaultEndDate(), consent: false
});

const CommunityAnnouncementRequestCard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');
  const [form, setForm] = useState(emptyForm);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const { data: noticeTypes = [] } = useQuery({
    queryKey: ['community-announcement-categories'],
    queryFn: communityAnnouncementService.getCategories,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
  const { data: publicNotices = [], isLoading: isBoardLoading } = useQuery({
    queryKey: ['community-announcements-public'],
    queryFn: communityAnnouncementService.listPublic,
    enabled: isOpen,
    refetchInterval: 30000,
    retry: 1
  });
  const submitMutation = useMutation({
    mutationFn: (payload) => communityAnnouncementService.submit(payload),
    onSuccess: () => {
      setForm(emptyForm());
      setNotice({ type: 'success', text: 'Your notice has been sent for admin review. It will appear on the LED board only after approval.' });
    },
    onError: (error) => setNotice({ type: 'error', text: error?.response?.data?.message || error.message || 'Unable to submit your notice. Please try again.' })
  });

  const update = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const uploadImage = async (file) => {
    if (!file) return;
    try {
      setUploadProgress(0);
      setNotice({ type: '', text: '' });
      const uploaded = await uploadService.uploadFile({
        service: 'community-notices',
        file,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        maxSizeMB: 5,
        onProgress: setUploadProgress
      });
      if (!uploaded?.url) throw new Error('Photo upload did not return a file link.');
      setForm((current) => ({ ...current, imageUrl: uploaded.url }));
      setNotice({ type: 'success', text: 'Photo uploaded. It will remain hidden until the notice is approved.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Unable to upload the photo.' });
    } finally {
      setUploadProgress(null);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    setNotice({ type: '', text: '' });
    if (form.noticeFormat === 'poster' && !form.imageUrl) {
      setNotice({ type: 'error', text: 'Upload a poster image before submitting this full-page notice.' });
      return;
    }
    submitMutation.mutate({ ...form, contactValue: form.contactPreference === 'none' ? '' : form.contactValue.trim() });
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => { if (event.key === 'Escape' && !submitMutation.isPending) setIsOpen(false); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, submitMutation.isPending]);

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-[#143b66] to-[#245a82] px-5 py-4 text-white">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-amber-300"><MegaphoneIcon className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1"><h2 className="font-heading text-xl font-bold">Community Notice Board</h2><p className="text-xs text-blue-100">ਸੰਗਤ ਲਈ ਸੇਵਾਵਾਂ ਅਤੇ ਐਲਾਨ · Browse notices or submit one for review</p></div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">{publicNotices.length} live</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <p className="max-w-2xl text-sm leading-6 text-slate-600">Find Gurdwara and community services, newcomer support, rentals, school information, volunteer opportunities, celebrations, condolences, and more—all reviewed before appearing on the LED board.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setActiveTab('browse'); setIsOpen(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-blue/30 bg-white px-4 py-2 text-sm font-extrabold text-brand-blue hover:bg-blue-50">Browse notices <ArrowRightIcon className="h-4 w-4" /></button>
          <button type="button" onClick={() => { setNotice({ type: '', text: '' }); setActiveTab('submit'); setIsOpen(true); }} className="min-h-10 rounded-xl bg-brand-blue px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-navy">Submit a notice</button>
        </div>
      </div>

      {isOpen ? <div className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-slate-950/60 p-2 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitMutation.isPending) setIsOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="community-notice-modal-title" className="my-auto flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
          <header className="flex items-center justify-between gap-3 bg-[#143b66] px-4 py-3 text-white sm:px-5">
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-300">Sangat notices · ਸੰਗਤ ਦੇ ਸੁਨੇਹੇ</p><h2 id="community-notice-modal-title" className="font-heading text-xl font-bold">Community Notice Board</h2></div>
            <button type="button" disabled={submitMutation.isPending} onClick={() => setIsOpen(false)} aria-label="Close community notice board" className="rounded-full p-2 hover:bg-white/10 disabled:opacity-50"><XMarkIcon className="h-5 w-5" /></button>
          </header>
          <div className="flex shrink-0 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <button type="button" onClick={() => setActiveTab('browse')} aria-pressed={activeTab === 'browse'} className={`rounded-lg px-3 py-2 text-xs font-extrabold ${activeTab === 'browse' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-white'}`}>Browse current notices ({publicNotices.length})</button>
            <button type="button" onClick={() => setActiveTab('submit')} aria-pressed={activeTab === 'submit'} className={`rounded-lg px-3 py-2 text-xs font-extrabold ${activeTab === 'submit' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-white'}`}>Request a notice</button>
          </div>

          {activeTab === 'browse' ? <div className="overflow-y-auto p-4 sm:p-5">
            <p className="mb-4 text-sm text-slate-600">Approved notices are also shown on the Community Announcements LED board. Contact details appear only when the submitter requested them and an admin approved display.</p>
            {isBoardLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading current notices…</p> : null}
            {!isBoardLoading && publicNotices.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><MegaphoneIcon className="mx-auto h-8 w-8 text-brand-blue/60" /><p className="mt-2 font-bold text-slate-800">No current notices</p><p className="mt-1 text-sm text-slate-500">Check back soon or submit a community notice for review.</p></div> : null}
            <div className="grid gap-3 md:grid-cols-2">
              {publicNotices.map((entry, index) => <article key={entry.id} className={`overflow-hidden rounded-xl border p-4 ${['border-amber-200 bg-amber-50', 'border-sky-200 bg-sky-50', 'border-emerald-200 bg-emerald-50', 'border-violet-200 bg-violet-50'][index % 4]}`}>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{COMMUNITY_ANNOUNCEMENT_CATEGORY_LABELS[entry.category] || 'Community notice'} · Until {entry.publishUntil}</p>
                {entry.noticeFormat === 'poster' && entry.imageUrl ? <img src={entry.imageUrl} alt={entry.titleEnglish || entry.titlePunjabi || 'Community poster'} className="mt-2 max-h-72 w-full rounded-lg bg-slate-900 object-contain" /> : null}
                {entry.noticeFormat !== 'poster' ? <>
                  {entry.titlePunjabi ? <h3 lang="pa" className="mt-2 font-gurmukhi text-lg font-extrabold">{entry.titlePunjabi}</h3> : null}
                  {entry.titleEnglish ? <p className="mt-1 font-bold">{entry.titleEnglish}</p> : null}
                  {entry.descriptionPunjabi ? <p lang="pa" className="mt-2 whitespace-pre-line font-gurmukhi text-sm leading-6 text-slate-700">{entry.descriptionPunjabi}</p> : null}
                  {entry.descriptionEnglish ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{entry.descriptionEnglish}</p> : null}
                </> : null}
                {entry.submitterName ? <p className="mt-3 text-xs font-bold text-slate-500">Shared by {entry.submitterName}</p> : null}
                {entry.contactValue ? <p className="mt-3 border-t border-slate-300/60 pt-2 text-xs font-bold">{entry.contactPreference}: {entry.contactValue}</p> : null}
              </article>)}
            </div>
          </div> : <form onSubmit={submit} className="grid gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-2">
        <div className="lg:col-span-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-950">
          Share community services, newcomer and government resources, school information, volunteer opportunities, lost-and-found, celebrations, condolences, blood drives, or housing such as a house, basement, lease, or rental. Every notice is reviewed by the Gurdwara team before it appears publicly.
        </div>
        <label className="text-xs font-bold text-slate-700">Category
          <select value={form.category} onChange={update('category')} className={fieldClass}>{[...COMMUNITY_ANNOUNCEMENT_CATEGORIES, ...noticeTypes].filter((entry, index, list) => list.findIndex((candidate) => candidate.value === entry.value) === index).map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
        </label>
        <label className="text-xs font-bold text-slate-700">Audience
          <select value={form.audience} onChange={update('audience')} className={fieldClass}><option value="sangat">Sangat / Gurdwara community</option><option value="public">Public / anyone in the community</option></select>
        </label>
        <fieldset className="grid gap-2 rounded-xl border border-slate-200 p-3 lg:col-span-2">
          <legend className="px-1 text-xs font-extrabold text-slate-700">How should it appear on the LED board?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[{ value: 'text', label: 'Text notice', description: 'Bilingual text shown on a readable community card.' }, { value: 'poster', label: 'Full-page poster', description: 'Display your uploaded flyer edge-to-edge. No extra text is overlaid.' }].map((option) => <label key={option.value} className={`flex cursor-pointer gap-2 rounded-lg border p-3 ${form.noticeFormat === option.value ? 'border-brand-blue bg-blue-50' : 'border-slate-200'}`}><input type="radio" name="noticeFormat" value={option.value} checked={form.noticeFormat === option.value} onChange={() => setForm((current) => ({ ...current, noticeFormat: option.value, imageUrl: option.value === 'text' ? '' : current.imageUrl }))} /><span><span className="block text-sm font-bold text-slate-800">{option.label}</span><span className="mt-0.5 block text-xs text-slate-500">{option.description}</span></span></label>)}
          </div>
        </fieldset>
        {form.noticeFormat === 'poster' ? (
          <div className="rounded-xl border border-slate-200 p-3 lg:col-span-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><PhotoIcon className="h-4 w-4 text-brand-blue" /> Poster image (shown full screen)
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { void uploadImage(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
            <p className="mt-1 text-[11px] text-slate-500">Use a finished flyer/poster image · landscape 16:9 recommended · JPG, PNG, WebP or GIF · max 5 MB.</p>
            {uploadProgress !== null ? <p role="status" className="mt-2 text-xs font-semibold text-brand-blue">Uploading poster… {uploadProgress}%</p> : null}
            {form.imageUrl ? <div className="mt-2 flex items-center gap-2"><img src={form.imageUrl} alt="Poster preview" className="h-16 w-28 rounded-lg border border-slate-200 object-cover" /><span className="text-xs font-semibold text-emerald-700">Full-page poster attached</span><button type="button" onClick={() => setForm((current) => ({ ...current, imageUrl: '' }))} className="ml-auto text-xs font-bold text-rose-700">Remove</button></div> : null}
          </div>
        ) : (
          <>
            <label className="text-xs font-bold text-slate-700">Title in English<input required={form.noticeFormat === 'text' && !form.titlePunjabi} value={form.titleEnglish} onChange={update('titleEnglish')} maxLength={100} placeholder="e.g. Basement for rent in Milton" className={fieldClass} /></label>
            <label lang="pa" className="text-xs font-bold text-slate-700">ਪੰਜਾਬੀ ਵਿੱਚ ਸਿਰਲੇਖ<input lang="pa" required={form.noticeFormat === 'text' && !form.titleEnglish} value={form.titlePunjabi} onChange={update('titlePunjabi')} maxLength={100} placeholder="ਉਦਾਹਰਨ: ਮਿਲਟਨ ਵਿੱਚ ਬੇਸਮੈਂਟ ਕਿਰਾਏ ਲਈ" className={`${fieldClass} font-gurmukhi`} /></label>
            <label className="text-xs font-bold text-slate-700">Description in English<textarea required={form.noticeFormat === 'text' && !form.descriptionPunjabi} value={form.descriptionEnglish} onChange={update('descriptionEnglish')} rows={3} maxLength={1000} placeholder="Provide helpful details. Avoid including sensitive personal information." className={fieldClass} /><span className="mt-1 block text-right text-[10px] font-normal text-slate-500">{form.descriptionEnglish.length}/1000</span></label>
            <label lang="pa" className="text-xs font-bold text-slate-700">ਵੇਰਵਾ ਪੰਜਾਬੀ ਵਿੱਚ<textarea lang="pa" required={form.noticeFormat === 'text' && !form.descriptionEnglish} value={form.descriptionPunjabi} onChange={update('descriptionPunjabi')} rows={3} maxLength={1000} placeholder="ਲੋੜੀਂਦੀ ਜਾਣਕਾਰੀ ਦਿਓ। ਨਿੱਜੀ ਜਾਂ ਸੰਵੇਦਨਸ਼ੀਲ ਜਾਣਕਾਰੀ ਨਾ ਲਿਖੋ।" className={`${fieldClass} font-gurmukhi`} /><span className="mt-1 block text-right text-[10px] font-normal text-slate-500">{form.descriptionPunjabi.length}/1000</span></label>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-700">Display from
            <input type="date" min={today()} required value={form.publishFrom} onChange={update('publishFrom')} className={fieldClass} />
          </label>
          <label className="text-xs font-bold text-slate-700">Display until
            <input type="date" min={form.publishFrom || today()} required value={form.publishUntil} onChange={update('publishUntil')} className={fieldClass} />
          </label>
          <p className="col-span-2 text-[11px] text-slate-500">Notices can run for up to 60 days and automatically disappear after the end date.</p>
        </div>
        <label className="text-xs font-bold text-slate-700">How may interested people contact you?
          <select value={form.contactPreference} onChange={(event) => setForm((current) => ({ ...current, contactPreference: event.target.value, contactValue: event.target.value === 'none' ? '' : current.contactValue }))} className={fieldClass}>
            <option value="none">Do not show my contact details</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option>
          </select>
        </label>
        {form.contactPreference !== 'none' ? <label className="text-xs font-bold text-slate-700">Contact detail (shown only if you consent and admin approves)
          <input required value={form.contactValue} onChange={update('contactValue')} maxLength={180} className={fieldClass} placeholder={form.contactPreference === 'email' ? 'name@example.com' : 'Phone number'} />
        </label> : <p className="self-center rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Your contact information is never shown unless you choose a contact method and the admin explicitly approves displaying it.</p>}
        <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700 lg:col-span-2">
          <input required type="checkbox" checked={form.consent} onChange={update('consent')} className="mt-0.5 h-4 w-4 accent-brand-blue" />
          <span>I confirm this notice is accurate, appropriate for the community, and that I have permission to share its text, photo, and any contact details. I understand it will be reviewed and may be edited or declined.</span>
        </label>
        {notice.text ? <p role={notice.type === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2.5 text-sm font-semibold lg:col-span-2 ${notice.type === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
          <p className="text-[11px] text-slate-500">Housing, services, newcomers, government help, and community ads are welcome when lawful and non-misleading. Commercial or unsafe content may be declined.</p>
          <button type="submit" disabled={submitMutation.isPending || uploadProgress !== null} className="min-h-11 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-navy disabled:cursor-not-allowed disabled:opacity-50">{submitMutation.isPending ? 'Sending for review…' : 'Submit for review'}</button>
        </div>
          </form>}
        </section>
      </div> : null}
    </section>
  );
};

export default CommunityAnnouncementRequestCard;
