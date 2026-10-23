import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import StatusAlert from '../../components/common/StatusAlert';
import { COMMUNITY_ANNOUNCEMENT_CATEGORIES } from '../../constants/communityAnnouncements';
import uploadService from '../../services/uploadService';

const dateValue = (value) => String(value || '').slice(0, 10);
const localDate = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800';

const CommunityNoticeFormDialog = ({ notice, categories = [], onSave, onClose, isPending = false, error = '' }) => {
  const isEditing = Boolean(notice);
  const dialogRef = useRef(null);
  const [values, setValues] = useState(() => ({
    noticeFormat: notice?.noticeFormat || (notice?.imageUrl ? 'poster' : 'text'),
    publisherName: notice?.publisherName || notice?.submitterName || '',
    category: notice?.category || 'community-service', audience: notice?.audience || 'sangat',
    titleEnglish: notice?.titleEnglish || '', titlePunjabi: notice?.titlePunjabi || '',
    descriptionEnglish: notice?.descriptionEnglish || '', descriptionPunjabi: notice?.descriptionPunjabi || '',
    imageUrl: notice?.imageUrl || '',
    publishFrom: dateValue(notice?.publishFrom) || localDate(),
    publishUntil: dateValue(notice?.publishUntil) || localDate(30),
    contactPreference: notice?.contactPreference || 'none', contactValue: notice?.contactValue || '',
    showContact: notice ? notice.showContact === true : true
  }));
  const [uploadProgress, setUploadProgress] = useState(null);
  const [localError, setLocalError] = useState('');
  const busy = isPending || uploadProgress !== null;
  const options = [...COMMUNITY_ANNOUNCEMENT_CATEGORIES, ...categories].filter((entry, index, all) => all.findIndex((item) => item.value === entry.value) === index);
  const setField = (field, value) => setValues((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('input')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);

  const uploadPoster = async (file) => {
    if (!file) return;
    setLocalError('');
    setUploadProgress(0);
    try {
      const uploaded = await uploadService.uploadFile({ service: 'community-notices', file, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxSizeMB: 5, onProgress: setUploadProgress });
      if (!uploaded?.url) throw new Error('The poster upload did not return an image. Please try again.');
      setField('imageUrl', uploaded.url);
    } catch (cause) {
      setLocalError(cause.message || 'Unable to upload the poster.');
    } finally { setUploadProgress(null); }
  };
  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    if (values.noticeFormat === 'poster' && !values.imageUrl) {
      setLocalError('Upload a poster image before saving the notice.');
      return;
    }
    setLocalError('');
    onSave({
      ...values,
      titleEnglish: values.noticeFormat === 'text' ? values.titleEnglish.trim() : '',
      titlePunjabi: values.noticeFormat === 'text' ? values.titlePunjabi.trim() : '',
      descriptionEnglish: values.noticeFormat === 'text' ? values.descriptionEnglish.trim() : '',
      descriptionPunjabi: values.noticeFormat === 'text' ? values.descriptionPunjabi.trim() : '',
      imageUrl: values.noticeFormat === 'poster' ? values.imageUrl : '',
      contactValue: values.contactPreference === 'none' ? '' : values.contactValue.trim(),
      showContact: values.contactPreference !== 'none' && values.showContact
    });
  };
  const handleKeys = (event) => {
    if (event.key === 'Escape' && !busy) onClose();
    if (event.key !== 'Tab') return;
    const fields = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
    const first = fields[0];
    const last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[281] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="community-notice-form-title" onKeyDown={handleKeys} onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3"><h3 id="community-notice-form-title" className="font-heading text-xl font-bold">{isEditing ? 'Edit community notice' : 'Add community notice'}</h3><button type="button" disabled={busy} onClick={onClose} aria-label="Close notice form" className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50"><XMarkIcon className="h-5 w-5" /></button></div>
        <p className="mt-1 text-sm text-slate-500">{isEditing ? 'Update the notice details, poster, schedule and contact visibility.' : 'Admin notices are approved automatically and display during the selected dates.'}</p>
        <div className="mt-3"><StatusAlert type="error" message={localError || error} /></div>
        <fieldset disabled={busy} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Posted by<input required maxLength={120} value={values.publisherName} onChange={(event) => setField('publisherName', event.target.value)} className={fieldClass} /></label>
          <label className="text-xs font-bold text-slate-700">Notice type<select value={values.category} onChange={(event) => setField('category', event.target.value)} className={fieldClass}>{options.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-700">Audience<select value={values.audience} onChange={(event) => setField('audience', event.target.value)} className={fieldClass}><option value="sangat">Sangat</option><option value="public">Public</option></select></label>
          <label className="text-xs font-bold text-slate-700">Format<select value={values.noticeFormat} onChange={(event) => setValues((current) => ({ ...current, noticeFormat: event.target.value, imageUrl: event.target.value === 'text' ? '' : current.imageUrl }))} className={fieldClass}><option value="text">Text notice</option><option value="poster">Full-page poster</option></select></label>
          {values.noticeFormat === 'text' ? <>
            <label className="text-xs font-bold text-slate-700">English title<input required={!values.titlePunjabi.trim()} maxLength={100} value={values.titleEnglish} onChange={(event) => setField('titleEnglish', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-bold text-slate-700">Punjabi title<input lang="pa" required={!values.titleEnglish.trim()} maxLength={100} value={values.titlePunjabi} onChange={(event) => setField('titlePunjabi', event.target.value)} className={`${fieldClass} font-gurmukhi`} /></label>
            <label className="text-xs font-bold text-slate-700">English description<textarea required={!values.descriptionPunjabi.trim()} rows={4} maxLength={1000} value={values.descriptionEnglish} onChange={(event) => setField('descriptionEnglish', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-bold text-slate-700">Punjabi description<textarea lang="pa" required={!values.descriptionEnglish.trim()} rows={4} maxLength={1000} value={values.descriptionPunjabi} onChange={(event) => setField('descriptionPunjabi', event.target.value)} className={`${fieldClass} font-gurmukhi`} /></label>
          </> : <div className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
            <label className="text-xs font-bold text-slate-700">Upload full-page poster<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { void uploadPoster(event.target.files?.[0]); event.target.value = ''; }} className="mt-2 block w-full text-sm" /></label>
            <p className="mt-2 text-xs text-slate-500">JPG, PNG, WebP or GIF, up to 5 MB. Only the image is displayed.</p>
            {uploadProgress !== null ? <p role="status" className="mt-2 text-sm">Uploading {uploadProgress}%</p> : null}
            {values.imageUrl ? <div className="mt-3 flex items-start gap-3"><img src={values.imageUrl} alt="Notice poster preview" className="max-h-48 max-w-[75%] rounded-lg object-contain" /><button type="button" onClick={() => setField('imageUrl', '')} className="text-xs font-bold text-rose-700">Remove poster</button></div> : null}
          </div>}
          <label className="text-xs font-bold text-slate-700">Display from<input type="date" required min={isEditing ? undefined : localDate()} value={values.publishFrom} onChange={(event) => setField('publishFrom', event.target.value)} className={fieldClass} /></label>
          <label className="text-xs font-bold text-slate-700">Display until<input type="date" required min={values.publishFrom} value={values.publishUntil} onChange={(event) => setField('publishUntil', event.target.value)} className={fieldClass} /></label>
          <label className="text-xs font-bold text-slate-700">Contact method<select value={values.contactPreference} onChange={(event) => setValues((current) => ({ ...current, contactPreference: event.target.value, contactValue: event.target.value === 'none' ? '' : current.contactValue }))} className={fieldClass}><option value="none">None</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></label>
          {values.contactPreference !== 'none' ? <label className="text-xs font-bold text-slate-700">Contact detail<input required maxLength={180} value={values.contactValue} onChange={(event) => setField('contactValue', event.target.value)} className={fieldClass} /></label> : null}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" disabled={values.contactPreference === 'none'} checked={values.contactPreference !== 'none' && values.showContact} onChange={(event) => setField('showContact', event.target.checked)} /> Show contact details publicly</label>
        </fieldset>
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : isEditing ? 'Save changes' : 'Create and publish notice'}</button></div>
      </form>
    </div>,
    document.body
  );
};

export default CommunityNoticeFormDialog;