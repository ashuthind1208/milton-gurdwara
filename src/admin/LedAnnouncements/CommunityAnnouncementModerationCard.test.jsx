import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CommunityAnnouncementModerationCard from './CommunityAnnouncementModerationTable';
import communityAnnouncementService from '../../services/communityAnnouncementService';
import uploadService from '../../services/uploadService';

jest.mock('../../services/uploadService', () => ({ __esModule: true, default: { uploadFile: jest.fn() } }));

jest.mock('../../services/communityAnnouncementService', () => ({
  __esModule: true,
  default: { listForReview: jest.fn(), createForAdmin: jest.fn(), review: jest.fn(), remove: jest.fn(), getCategories: jest.fn() }
}));

const pendingNotice = {
  id: 'notice-1', status: 'pending', titleEnglish: 'Basement for rent', titlePunjabi: 'ਬੇਸਮੈਂਟ ਕਿਰਾਏ ਲਈ',
  descriptionEnglish: 'Two rooms in Milton.', descriptionPunjabi: 'ਮਿਲਟਨ ਵਿੱਚ ਦੋ ਕਮਰੇ।',
  category: 'housing-rental', audience: 'public', submitterName: 'Sangat Member', submitterEmail: 'member@example.com',
  contactPreference: 'phone', contactValue: '905-555-0123', showContact: false,
  publishFrom: '2026-10-22', publishUntil: '2026-11-01', featured: false
};

const Harness = () => {
  const [creating, setCreating] = useState(false);
  return <><button type="button" onClick={() => setCreating(true)}>Add notice</button><CommunityAnnouncementModerationCard creating={creating} onCreatingChange={setCreating} /></>;
};
const renderCard = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><Harness /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  communityAnnouncementService.listForReview.mockResolvedValue([pendingNotice]);
  communityAnnouncementService.review.mockResolvedValue({ ...pendingNotice, status: 'approved' });
  communityAnnouncementService.remove.mockResolvedValue({ deleted: true });
  communityAnnouncementService.getCategories.mockResolvedValue([]);
  communityAnnouncementService.createForAdmin.mockResolvedValue({ ...pendingNotice, status: 'approved' });
  uploadService.uploadFile.mockResolvedValue({ url: '/api/uploads/community-notices/new-poster.png' });
});

test('defaults to all notices in a compact table with row actions and approval switch', async () => {
  renderCard();
  expect(await screen.findByText('Basement for rent')).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Add notice' })).toHaveLength(1);
  expect(screen.getByLabelText('Filter community notices')).toHaveValue('all');
  expect(screen.getByRole('button', { name: 'View Basement for rent' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit Basement for rent' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete Basement for rent' })).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Approve Basement for rent' })).toHaveAttribute('aria-checked', 'false');
});

test('approval toggle publishes a pending notice through the moderation API', async () => {
  renderCard();
  await userEvent.click(await screen.findByRole('switch', { name: 'Approve Basement for rent' }));
  expect(communityAnnouncementService.review).toHaveBeenCalledWith('notice-1', expect.objectContaining({ status: 'approved', showContact: false }));
  expect(await screen.findByText('Community notice saved.')).toBeInTheDocument();
});

test('view action opens a notice details dialog', async () => {
  renderCard();
  await userEvent.click(await screen.findByRole('button', { name: 'View Basement for rent' }));
  expect(screen.getByRole('dialog', { name: 'Community notice details' })).toBeInTheDocument();
  expect(screen.getByRole('dialog').parentElement).toHaveClass('backdrop-blur-sm');
  expect(screen.getByText('Two rooms in Milton.')).toBeInTheDocument();
});

test('edit action opens editor and saves publisher name', async () => {
  renderCard();
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Basement for rent' }));
  expect(screen.getByRole('dialog', { name: 'Edit community notice' })).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText('Posted by'));
  await userEvent.type(screen.getByLabelText('Posted by'), 'Committee');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(communityAnnouncementService.review).toHaveBeenCalledWith('notice-1', expect.objectContaining({ publisherName: 'Committee' }));
  expect(await screen.findByText('Community notice saved.')).toBeInTheDocument();
});

test('add button opens a popup with the same fields as editing', async () => {
  renderCard();
  await userEvent.click(screen.getByRole('button', { name: 'Add notice' }));
  const add = screen.getByRole('dialog', { name: 'Add community notice' });
  expect(add.parentElement).toHaveClass('backdrop-blur-sm');
  const labels = ['Posted by', 'Notice type', 'Audience', 'Format', 'English title', 'Punjabi title', 'English description', 'Punjabi description', 'Display from', 'Display until', 'Contact method', 'Show contact details publicly'];
  labels.forEach((label) => expect(within(add).getByLabelText(label)).toBeInTheDocument());
  await userEvent.click(within(add).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Basement for rent' }));
  const edit = screen.getByRole('dialog', { name: 'Edit community notice' });
  expect(edit.parentElement).toHaveClass('backdrop-blur-sm');
  labels.forEach((label) => expect(within(edit).getByLabelText(label)).toBeInTheDocument());
  expect(within(edit).getByLabelText('Audience')).toHaveValue('public');
  expect(within(edit).getByLabelText('Display from')).toHaveValue('2026-10-22');
});

test('delete confirmation blurs the background and supports cancel and confirm', async () => {
  renderCard();
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Basement for rent' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete community notice?' });
  expect(dialog.parentElement).toHaveClass('backdrop-blur-sm');
  expect(communityAnnouncementService.remove).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete Basement for rent' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete notice' }));
  expect(await screen.findByText('Community notice deleted.')).toBeInTheDocument();
  expect(communityAnnouncementService.remove).toHaveBeenCalledWith('notice-1');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('creates a text notice with format, schedule, publisher and contact privacy', async () => {
  renderCard();
  await userEvent.click(screen.getByRole('button', { name: 'Add notice' }));
  await userEvent.type(screen.getByLabelText('Posted by'), 'Committee');
  await userEvent.type(screen.getByLabelText('English title'), 'Community event');
  await userEvent.type(screen.getByLabelText('English description'), 'Join the sangat.');
  await userEvent.selectOptions(screen.getByLabelText('Audience'), 'public');
  await userEvent.click(screen.getByRole('button', { name: 'Create and publish notice' }));
  expect(await screen.findByText('Notice created and approved.')).toBeInTheDocument();
  expect(communityAnnouncementService.createForAdmin).toHaveBeenCalledWith(expect.objectContaining({ noticeFormat: 'text', publisherName: 'Committee', audience: 'public', titleEnglish: 'Community event', imageUrl: '', showContact: false, publishFrom: expect.any(String), publishUntil: expect.any(String) }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('editing supports audience and both display dates', async () => {
  renderCard();
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Basement for rent' }));
  await userEvent.selectOptions(screen.getByLabelText('Audience'), 'sangat');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByText('Community notice saved.')).toBeInTheDocument();
  expect(communityAnnouncementService.review).toHaveBeenCalledWith('notice-1', expect.objectContaining({ audience: 'sangat', publishFrom: '2026-10-22', publishUntil: '2026-11-01' }));
});

test('editing uploads a poster instead of requiring an image URL', async () => {
  renderCard();
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Basement for rent' }));
  await userEvent.selectOptions(screen.getByLabelText('Format'), 'poster');
  expect(screen.queryByLabelText('English title')).not.toBeInTheDocument();
  await userEvent.upload(screen.getByLabelText('Upload full-page poster'), new File(['image'], 'poster.png', { type: 'image/png' }));
  expect(await screen.findByAltText('Notice poster preview')).toHaveAttribute('src', '/api/uploads/community-notices/new-poster.png');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByText('Community notice saved.')).toBeInTheDocument();
  expect(communityAnnouncementService.review).toHaveBeenCalledWith('notice-1', expect.objectContaining({ noticeFormat: 'poster', imageUrl: '/api/uploads/community-notices/new-poster.png', titleEnglish: '', descriptionEnglish: '' }));
});

test('creation errors remain visible inside the popup without losing input', async () => {
  communityAnnouncementService.createForAdmin.mockRejectedValueOnce({ response: { data: { message: 'Choose a valid announcement category.' } } });
  renderCard();
  await userEvent.click(screen.getByRole('button', { name: 'Add notice' }));
  await userEvent.type(screen.getByLabelText('Posted by'), 'Committee');
  await userEvent.type(screen.getByLabelText('English title'), 'Community event');
  await userEvent.type(screen.getByLabelText('English description'), 'Join us.');
  await userEvent.click(screen.getByRole('button', { name: 'Create and publish notice' }));
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByText('Choose a valid announcement category.')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('English title')).toHaveValue('Community event');
});
