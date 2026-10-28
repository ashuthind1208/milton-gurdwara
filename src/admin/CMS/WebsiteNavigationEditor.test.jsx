import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WebsiteNavigationEditor from './WebsiteNavigationEditor';
import siteNavigationService, { DEFAULT_SITE_NAVIGATION } from '../../services/siteNavigationService';

jest.mock('../../services/siteNavigationService', () => {
  const actual = jest.requireActual('../../services/siteNavigationService');
  return { ...actual, __esModule: true, default: { get: jest.fn(), save: jest.fn() } };
});

const setup = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><WebsiteNavigationEditor /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  siteNavigationService.get.mockResolvedValue(DEFAULT_SITE_NAVIGATION);
  siteNavigationService.save.mockImplementation(async (items) => items);
});

test('caps main menu items at ten', async () => {
  setup();
  expect(await screen.findByText('10 / 10 main items')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add main item' })).toBeDisabled();
});

test('renames a menu and publishes child links underneath it', async () => {
  setup();
  const summary = await screen.findByText(/7\. Bookings/);
  fireEvent.click(summary);
  const label = screen.getByLabelText('Menu 7 label');
  await waitFor(() => expect(label).toBeEnabled());
  await userEvent.clear(label);
  await userEvent.type(label, 'Services offered');
  await userEvent.click(screen.getByRole('button', { name: 'Add submenu to Services offered' }));
  await userEvent.type(screen.getByLabelText('Services offered submenu 1 label'), 'Weekly programs');
  const path = screen.getByLabelText('Services offered submenu 1 link');
  await userEvent.clear(path);
  await userEvent.type(path, '/events');
  await userEvent.click(screen.getByRole('button', { name: 'Save navigation' }));
  expect(await screen.findByText('Website navigation published.')).toBeInTheDocument();
  expect(siteNavigationService.save).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ label: 'Services offered', children: [expect.objectContaining({ label: 'Weekly programs', path: '/events' })] })]));
});

test('prevents editing if saved navigation cannot be loaded', async () => {
  siteNavigationService.get.mockRejectedValue(new Error('Unavailable'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load saved navigation');
  expect(screen.getByRole('button', { name: 'Save navigation' })).toBeDisabled();
});