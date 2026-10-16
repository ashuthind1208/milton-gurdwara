import {
  DEFAULT_HUKAMNAMA_LED_SETTINGS,
  HUKAMNAMA_LED_TEMPLATES,
  normalizeHukamnamaLedSettings
} from './hukamnamaLedTemplates';

test('provides the current default and ornate reference Hukamnama layouts', () => {
  expect(HUKAMNAMA_LED_TEMPLATES).toHaveLength(2);
  expect(HUKAMNAMA_LED_TEMPLATES[0].id).toBe('original-default');
  expect(HUKAMNAMA_LED_TEMPLATES[1].id).toBe('ornate-tricolumn');
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
  expect(settings.titleEnglishColor).toBe(DEFAULT_HUKAMNAMA_LED_SETTINGS.titleEnglishColor);
  expect(settings.titlePunjabiFont).toBe(DEFAULT_HUKAMNAMA_LED_SETTINGS.titlePunjabiFont);
});
