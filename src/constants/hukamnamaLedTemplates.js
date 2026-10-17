export const HUKAMNAMA_LED_TEMPLATE_RESOURCE = 'hukamnama_led_template_settings';
export const HUKAMNAMA_LED_SETTINGS_SYNC_KEY = 'ssm-hukamnama-led-settings-updated-at';

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
  { id: 'ornate-tricolumn', name: 'Darbar Sahib · Three Panels', description: 'Ornate gold frame, centered Gurbani, Punjabi explanation left, English right.' },
  { id: 'original-paired-columns', name: 'OG · Two Columns, Line by Line', description: 'The original dark board with each Gurbani line followed by Punjabi and English translations in two flowing columns.' },
  { id: 'single-column-translation', name: 'Single Column · Punjabi Translation', description: 'A compact poster-style layout with two Gurbani lines and the Punjabi translation below.' }
]);

export const normalizeHukamnamaLedSettings = (raw = {}) => {
  const templateId = HUKAMNAMA_LED_TEMPLATES.some((template) => template.id === raw.templateId)
    ? raw.templateId
    : DEFAULT_HUKAMNAMA_LED_SETTINGS.templateId;
  const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
  const darkBackground = ['original-default', 'original-paired-columns', 'single-column-translation'].includes(templateId);
  const readableTitleColor = (value, fallback) => {
    const color = safeColor(value, fallback);
    if (!darkBackground) return color;
    const channels = color.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16) / 255);
    const brightness = (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
    return brightness >= 0.48 ? color : fallback;
  };
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
    titleEnglishColor: readableTitleColor(raw.titleEnglishColor, darkBackground ? '#FFFFFF' : DEFAULT_HUKAMNAMA_LED_SETTINGS.titleEnglishColor),
    titlePunjabiColor: readableTitleColor(raw.titlePunjabiColor, darkBackground ? '#F6D98B' : DEFAULT_HUKAMNAMA_LED_SETTINGS.titlePunjabiColor),
    showTitleEnglish: raw.showTitleEnglish !== false,
    showTitlePunjabi: raw.showTitlePunjabi !== false,
    showFooter: raw.showFooter !== false
  };
};
