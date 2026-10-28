import cmsService from './cmsService';
import contentApiService from './contentApiService';

jest.mock('./contentApiService', () => ({ __esModule: true, default: { getSingleton: jest.fn(), setSingleton: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  contentApiService.getSingleton.mockResolvedValue({ panjpyaare: { heroTitle: 'Panj Pyaare', intro: '<p>Learn about the Panj Pyaare.</p>', sections: [{ id: 'one', title: 'History', body: 'Content' }] } });
  contentApiService.setSingleton.mockImplementation(async (resource, data) => data);
});

test('reads custom pages and their sections', async () => {
  const { data } = await cmsService.getPageContent('panjpyaare');
  expect(data.heroTitle).toBe('Panj Pyaare');
  expect(data.sections[0].title).toBe('History');
});

test('editing a built-in page preserves custom content', async () => {
  await cmsService.updatePageContent('about', { heroTitle: 'About us' });
  expect(contentApiService.setSingleton).toHaveBeenCalledWith('cms_page_content', expect.objectContaining({ panjpyaare: expect.objectContaining({ heroTitle: 'Panj Pyaare' }) }));
});

test('creates and returns editable custom page content', async () => {
  const { data } = await cmsService.updatePageContent('programs/classes', { heroTitle: 'Classes', intro: 'Weekly classes', sections: [] });
  expect(data.heroTitle).toBe('Classes');
  expect(contentApiService.setSingleton).toHaveBeenCalledWith('cms_page_content', expect.objectContaining({ 'programs/classes': expect.objectContaining({ intro: 'Weekly classes' }) }));
});

test('unknown pages start blank rather than displaying About content', async () => {
  const { data } = await cmsService.getPageContent('new-page');
  expect(data.intro).toBe('');
  expect(data.sections).toEqual([]);
});