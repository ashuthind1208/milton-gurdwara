import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CommunityAnnouncementRequestCard from './CommunityAnnouncementRequestCard';
import communityAnnouncementService from '../../services/communityAnnouncementService';
import uploadService from '../../services/uploadService';

jest.mock('../../services/communityAnnouncementService', () => ({
  __esModule: true,
  default: { submit: jest.fn(), listPublic: jest.fn(), getCategories: jest.fn() }
}));
jest.mock('../../services/uploadService', () => ({ __esModule: true, default: { uploadFile: jest.fn() } }));

const renderCard = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><CommunityAnnouncementRequestCard /></QueryClientProvider>);

beforeEach(() => {
  communityAnnouncementService.submit.mockReset();
  communityAnnouncementService.listPublic.mockResolvedValue([]);
  communityAnnouncementService.getCategories.mockResolvedValue([]);
  uploadService.uploadFile.mockReset();
});

test('opens a popup that reveals current approved community board entries', async () => {
  communityAnnouncementService.listPublic.mockResolvedValue([{
    id: 'published-1',
    titleEnglish: 'Community legal clinic',
    titlePunjabi: 'ਕਮਿਊਨਿਟੀ ਕਾਨੂੰਨੀ ਕਲੀਨਿਕ',
    descriptionEnglish: 'Free newcomer information session.',
    descriptionPunjabi: 'ਨਵੇਂ ਆਏ ਲੋਕਾਂ ਲਈ ਮੁਫ਼ਤ ਜਾਣਕਾਰੀ।',
    category: 'newcomer-government-services',
    publishUntil: '2026-11-10',
    contactPreference: 'none',
    contactValue: ''
  }]);
  renderCard();
  await userEvent.click(screen.getByRole('button', { name: /Browse notices/ }));
  expect(await screen.findByRole('dialog', { name: 'Community Notice Board' })).toBeInTheDocument();
  expect(await screen.findByText('Community legal clinic')).toBeInTheDocument();
  expect(screen.getByText('ਕਮਿਊਨਿਟੀ ਕਾਨੂੰਨੀ ਕਲੀਨਿਕ')).toBeInTheDocument();
});

test('submits structured bilingual housing information for admin moderation from the popup', async () => {
  communityAnnouncementService.submit.mockResolvedValue({ id: 'notice-1', status: 'pending' });
  renderCard();
  await userEvent.click(screen.getByRole('button', { name: 'Submit a notice' }));
  await userEvent.type(screen.getByLabelText('Title in English'), 'Basement for rent');
  await userEvent.type(screen.getByLabelText('ਪੰਜਾਬੀ ਵਿੱਚ ਸਿਰਲੇਖ'), 'ਬੇਸਮੈਂਟ ਕਿਰਾਏ ਲਈ');
  await userEvent.type(screen.getByLabelText(/Description in English/), 'Two-bedroom basement available in Milton.');
  await userEvent.type(screen.getByLabelText(/ਵੇਰਵਾ ਪੰਜਾਬੀ ਵਿੱਚ/), 'ਮਿਲਟਨ ਵਿੱਚ ਬੇਸਮੈਂਟ ਉਪਲਬਧ ਹੈ।');
  await userEvent.selectOptions(screen.getByLabelText('Category'), 'housing-rental');
  await userEvent.selectOptions(screen.getByLabelText('How may interested people contact you?'), 'phone');
  await userEvent.type(screen.getByLabelText(/Contact detail/), '905-555-0199');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  expect(await screen.findByRole('status')).toHaveTextContent(/sent for admin review/i);
  expect(communityAnnouncementService.submit).toHaveBeenCalledWith(expect.objectContaining({
    titleEnglish: 'Basement for rent',
    titlePunjabi: 'ਬੇਸਮੈਂਟ ਕਿਰਾਏ ਲਈ',
    category: 'housing-rental',
    contactValue: '905-555-0199',
    consent: true
  }));
});

test('does not show or request contact details by default', async () => {
  renderCard();
  await userEvent.click(screen.getByRole('button', { name: 'Submit a notice' }));
  expect(screen.queryByLabelText(/Contact detail/)).not.toBeInTheDocument();
  expect(screen.getByText(/never shown unless you choose a contact method/i)).toBeInTheDocument();
});

test('allows an uploaded full-page poster without inline text fields', async () => {
  uploadService.uploadFile.mockResolvedValue({ url: '/api/uploads/community-notices/2026/10/poster.png' });
  renderCard();
  await userEvent.click(screen.getByRole('button', { name: 'Submit a notice' }));
  await userEvent.click(screen.getByLabelText(/Full-page poster/));
  expect(screen.queryByLabelText('Title in English')).not.toBeInTheDocument();
  const upload = screen.getByLabelText(/Poster image \(shown full screen\)/);
  fireEvent.change(upload, { target: { files: [new File(['poster'], 'poster.png', { type: 'image/png' })] } });
  expect(await screen.findByText('Full-page poster attached')).toBeInTheDocument();
  expect(uploadService.uploadFile).toHaveBeenCalledWith(expect.objectContaining({ service: 'community-notices' }));
});
