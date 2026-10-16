export const HUKAMNAMA_LED_TEMPLATE_RESOURCE = 'hukamnama_led_template_settings';

export const DEFAULT_HUKAMNAMA_LED_SETTINGS = Object.freeze({
  templateId: 'original-default',
  titleEnglish: 'Daily Hukamnama',
  titlePunjabi: 'ਅੱਜ ਦਾ ਹੁਕਮਨਾਮਾ',
  titleEnglishFont: 'Playfair Display',
  titleEnglishSize: 30,
  titleEnglishColor: '#15365B',
  titlePunjabiFont: 'Noto Sans Gurmukhi',
  titlePunjabiSize: 28,
  titlePunjabiColor: '#15365B',
  showTitleEnglish: true,
  showTitlePunjabi: true,
  showFooter: true
});

export const HUKAMNAMA_LED_TEMPLATES = Object.freeze([
  { id: 'original-default', name: 'Current Default · Dark Two Columns', description: 'Keeps the existing dark LED look with large Gurbani and bilingual translation columns.' },
  { id: 'ornate-tricolumn', name: 'Darbar Sahib · Three Panels', description: 'Ornate gold frame, centered Gurbani, Punjabi explanation left, English right.' }
]);

export const normalizeHukamnamaLedSettings = (raw = {}) => {
  const templateId = HUKAMNAMA_LED_TEMPLATES.some((template) => template.id === raw.templateId)
    ? raw.templateId
    : DEFAULT_HUKAMNAMA_LED_SETTINGS.templateId;
  const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
  const safeSize = (value, fallback, min, max) => Math.min(max, Math.max(min, Math.round(Number(value) || fallback)));
  return {
    ...DEFAULT_HUKAMNAMA_LED_SETTINGS,
    ...raw,
    templateId,
    titleEnglish: String(raw.titleEnglish ?? DEFAULT_HUKAMNAMA_LED_SETTINGS.titleEnglish).slice(0, 100),
    titlePunjabi: String(raw.titlePunjabi ?? DEFAULT_HUKAMNAMA_LED_SETTINGS.titlePunjabi).slice(0, 100),
    titleEnglishFont: ['Playfair Display', 'Crimson Text', 'Lora', 'Merriweather', 'Inter', 'Manrope'].includes(raw.titleEnglishFont) ? raw.titleEnglishFont : DEFAULT_HUKAMNAMA_LED_SETTINGS.titleEnglishFont,
    titlePunjabiFont: raw.titlePunjabiFont === 'Noto Sans Gurmukhi' ? raw.titlePunjabiFont : DEFAULT_HUKAMNAMA_LED_SETTINGS.titlePunjabiFont,
    titleEnglishSize: safeSize(raw.titleEnglishSize, DEFAULT_HUKAMNAMA_LED_SETTINGS.titleEnglishSize, 18, 64),
    titlePunjabiSize: safeSize(raw.titlePunjabiSize, DEFAULT_HUKAMNAMA_LED_SETTINGS.titlePunjabiSize, 18, 64),
    titleEnglishColor: safeColor(raw.titleEnglishColor, DEFAULT_HUKAMNAMA_LED_SETTINGS.titleEnglishColor),
    titlePunjabiColor: safeColor(raw.titlePunjabiColor, DEFAULT_HUKAMNAMA_LED_SETTINGS.titlePunjabiColor),
    showTitleEnglish: raw.showTitleEnglish !== false,
    showTitlePunjabi: raw.showTitlePunjabi !== false,
    showFooter: raw.showFooter !== false
  };
};
