import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../components/ui/Button';
import HukamnamaLedTemplate from '../../components/boards/HukamnamaLedTemplate';
import { useBranding } from '../../context/BrandingContext';
import hukamnamaService from '../../services/hukamnamaService';
import { DEFAULT_HUKAMNAMA_LED_SETTINGS, HUKAMNAMA_LED_TEMPLATES, normalizeHukamnamaLedSettings } from '../../constants/hukamnamaLedTemplates';

const AdminHukamnamaLedSettings = ({ entry, lines = [] }) => {
  const queryClient = useQueryClient();
  const { branding } = useBranding();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_HUKAMNAMA_LED_SETTINGS);
  const { data: savedSettings = DEFAULT_HUKAMNAMA_LED_SETTINGS } = useQuery({
    queryKey: ['hukamnama-led-template-settings'],
    queryFn: () => hukamnamaService.getLedTemplateSettings().then((response) => response.data),
    staleTime: 30 * 1000
  });

  useEffect(() => setSettings(normalizeHukamnamaLedSettings(savedSettings)), [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: (payload) => hukamnamaService.saveLedTemplateSettings(payload),
    onSuccess: (response) => {
      const normalized = normalizeHukamnamaLedSettings(response.data);
      setSettings(normalized);
      queryClient.setQueryData(['hukamnama-led-template-settings'], normalized);
    }
  });

  const update = (key, value) => setSettings((current) => normalizeHukamnamaLedSettings({ ...current, [key]: value }));
  const chooseTemplate = (templateId) => setSettings((current) => normalizeHukamnamaLedSettings({
    ...current,
    templateId,
    ...(templateId === 'original-default'
      ? { titleEnglishColor: '#FFFFFF', titlePunjabiColor: '#F6D98B' }
      : { titleEnglishColor: '#15365B', titlePunjabiColor: '#15365B' })
  }));

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-blue">LED Display</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-900">Hukamnama design</h2><p className="mt-1 text-sm text-slate-600">Choose a layout and format the centered Punjabi and English titles.</p></div>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => setPreviewOpen(true)}>Preview LED board</Button><Button type="button" onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : 'Save design'}</Button></div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Select a template</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {HUKAMNAMA_LED_TEMPLATES.map((template) => (
                <button key={template.id} type="button" onClick={() => chooseTemplate(template.id)} aria-pressed={settings.templateId === template.id} className={`rounded-xl border p-2.5 text-left transition ${settings.templateId === template.id ? 'border-brand-blue bg-blue-50 ring-2 ring-brand-blue/20' : 'border-slate-200 bg-white hover:border-brand-blue/40'}`}>
                  <span className={`mb-2 flex h-12 overflow-hidden rounded-md border p-1 ${template.id === 'original-default' ? 'border-slate-700 bg-slate-900' : 'border-amber-200 bg-amber-50'}`}>
                    {template.id === 'ornate-tricolumn' ? <><i className="m-0.5 flex-1 rounded-sm border border-amber-400/70 bg-white/80"/><i className="m-0.5 flex-1 rounded-sm border border-amber-400/70 bg-blue-100/80"/><i className="m-0.5 flex-1 rounded-sm border border-amber-400/70 bg-white/80"/></> : <><i className="m-1 flex-1 rounded-sm border border-amber-400/60 bg-white/70"/><i className="m-1 flex-1 rounded-sm border border-amber-400/60 bg-blue-100/70"/></>}
                  </span>
                  <span className="block text-xs font-bold text-slate-800">{template.name}</span><span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{template.description}</span>
                </button>
              ))}
            </div>
          </div>

          <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600">Centered title formatting</legend>
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-slate-700">English title<input value={settings.titleEnglish} maxLength={100} onChange={(event) => update('titleEnglish', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"/></label>
              <label className="block text-xs font-semibold text-slate-700">Punjabi title<input value={settings.titlePunjabi} maxLength={100} onChange={(event) => update('titlePunjabi', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-gurmukhi text-sm"/></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-700">English font<select value={settings.titleEnglishFont} onChange={(event) => update('titleEnglishFont', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">{['Playfair Display', 'Crimson Text', 'Lora', 'Merriweather', 'Inter', 'Manrope'].map((font) => <option key={font}>{font}</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-700">Punjabi font<select value={settings.titlePunjabiFont} onChange={(event) => update('titlePunjabiFont', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option>Noto Sans Gurmukhi</option></select></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-700">English size · {settings.titleEnglishSize}px<input type="range" min="18" max="64" value={settings.titleEnglishSize} onChange={(event) => update('titleEnglishSize', event.target.value)} className="mt-2 block w-full accent-brand-blue"/></label>
                <label className="text-xs font-semibold text-slate-700">Punjabi size · {settings.titlePunjabiSize}px<input type="range" min="18" max="64" value={settings.titlePunjabiSize} onChange={(event) => update('titlePunjabiSize', event.target.value)} className="mt-2 block w-full accent-brand-blue"/></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">English color<input type="color" value={settings.titleEnglishColor} onChange={(event) => update('titleEnglishColor', event.target.value.toUpperCase())} className="h-8 w-10 rounded border border-slate-300 bg-white p-1"/></label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">Punjabi color<input type="color" value={settings.titlePunjabiColor} onChange={(event) => update('titlePunjabiColor', event.target.value.toUpperCase())} className="h-8 w-10 rounded border border-slate-300 bg-white p-1"/></label>
              </div>
              <div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={settings.showTitleEnglish} onChange={(event) => update('showTitleEnglish', event.target.checked)} className="h-4 w-4 accent-brand-blue"/>Show English title</label><label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={settings.showTitlePunjabi} onChange={(event) => update('showTitlePunjabi', event.target.checked)} className="h-4 w-4 accent-brand-blue"/>Show Punjabi title</label></div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={settings.showFooter} onChange={(event) => update('showFooter', event.target.checked)} className="h-4 w-4 accent-brand-blue"/>Show Gurdwara footer</label>
            </div>
          </fieldset>
        </div>
        {saveMutation.isError ? <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{saveMutation.error?.response?.data?.message || saveMutation.error?.message || 'Could not save LED design settings.'}</p> : null}
        {saveMutation.isSuccess ? <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">LED Hukamnama design saved.</p> : null}
      </section>

      {previewOpen ? <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6" onClick={() => setPreviewOpen(false)}><div className="w-full max-w-[1500px]" role="dialog" aria-modal="true" aria-label="LED Hukamnama preview" onClick={(event) => event.stopPropagation()}><div className="mb-2 flex items-center justify-between text-white"><div><p className="text-sm font-bold">LED board preview</p><p className="text-xs text-white/70">{HUKAMNAMA_LED_TEMPLATES.find((template) => template.id === settings.templateId)?.name}</p></div><button type="button" onClick={() => setPreviewOpen(false)} className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10">Close</button></div><div className="aspect-video max-h-[82vh] w-full overflow-hidden rounded-lg shadow-2xl"><HukamnamaLedTemplate settings={settings} entry={entry || { ang: 692 }} lines={lines} branding={{ ...branding, logoSrc: branding.logoUrl || '' }} preview /></div></div></div> : null}
    </>
  );
};

export default AdminHukamnamaLedSettings;
