import {
  DEFAULT_HUKAMNAMA_LED_SETTINGS,
  HUKAMNAMA_LED_TEMPLATES,
  normalizeHukamnamaLedSettings
} from './hukamnamaLedTemplates';

test('provides the current default, ornate reference, original line-by-line and single-column layouts', () => {
  expect(HUKAMNAMA_LED_TEMPLATES).toHaveLength(4);
  expect(HUKAMNAMA_LED_TEMPLATES[0].id).toBe('original-default');
  expect(HUKAMNAMA_LED_TEMPLATES[1].id).toBe('ornate-tricolumn');
  expect(HUKAMNAMA_LED_TEMPLATES[2].id).toBe('original-paired-columns');
  expect(HUKAMNAMA_LED_TEMPLATES[3].id).toBe('single-column-translation');
});

test('normalizes unknown templates, title formatting and unsafe colors to defaults', () => {
  const settings = normalizeHukamnamaLedSettings({
    templateId: 'not-a-template',
    titleEnglish: 'A'.repeat(120),
    titleEnglishSize: 1000,
    titlePunjabiSize: 1,
    titleEnglishColor: 'red',
    titlePunjabiFont: 'Comic Sans'
  });

  expect(settings.templateId).toBe(DEFAULT_HUKAMNAMA_LED_SETTINGS.templateId);
  expect(settings.titleEnglish).toHaveLength(100);
  expect(settings.titleEnglishSize).toBe(64);
  expect(settings.titlePunjabiSize).toBe(18);
  expect(settings.titleEnglishColor).toBe('#FFFFFF');
  expect(settings.titlePunjabiFont).toBe(DEFAULT_HUKAMNAMA_LED_SETTINGS.titlePunjabiFont);
});

test('uses readable title colors on dark LED templates', () => {
  const settings = normalizeHukamnamaLedSettings({
    templateId: 'original-paired-columns',
    titleEnglishColor: '#15365B',
    titlePunjabiColor: '#15365B'
  });

  expect(settings.titleEnglishColor).toBe('#FFFFFF');
  expect(settings.titlePunjabiColor).toBe('#F6D98B');
  expect(normalizeHukamnamaLedSettings({ templateId: 'original-paired-columns', titleEnglishColor: '#FFD700' }).titleEnglishColor).toBe('#FFD700');
});
