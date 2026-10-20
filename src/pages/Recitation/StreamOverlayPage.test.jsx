import { render, screen } from '@testing-library/react';
import StreamOverlayPage from './StreamOverlayPage';
import { useRecitationLive, useRecitationText } from '../../hooks/useRecitation';
import { useBranding } from '../../context/BrandingContext';

jest.mock('../../hooks/useRecitation', () => ({ useRecitationLive: jest.fn(), useRecitationText: jest.fn() }));
jest.mock('../../context/BrandingContext', () => ({ useBranding: jest.fn() }));

describe('StreamOverlayPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/stream-overlay?embed=1&lang=gpe');
    useRecitationLive.mockReturnValue({ session: { currentIndex: 0 } });
    useRecitationText.mockReturnValue({ lines: [{ g: 'ਗੁਰਬਾਣੀ ਦੀ ਪੰਕਤੀ', p: 'ਪੰਜਾਬੀ ਅਰਥ', e: 'English meaning' }] });
    useBranding.mockReturnValue({ branding: { organizationName: 'Gurdwara Singh Sabha Milton', shortName: 'Singh Sabha', primaryColor: '#0B4EA2', accentColor: '#F4A300', address: '7035, Sixth Line, Milton' }, logoSrc: '/logo.png' });
  });

  test('renders translations, header, address and date in transparent overlay', () => {
    render(<StreamOverlayPage />);
    expect(screen.getByText('ਗੁਰਬਾਣੀ ਦੀ ਪੰਕਤੀ')).toBeInTheDocument();
    expect(screen.getByText('ਪੰਜਾਬੀ ਅਰਥ')).toBeInTheDocument();
    expect(screen.getByText('English meaning')).toBeInTheDocument();
    expect(screen.getByText('Gurdwara Singh Sabha')).toBeInTheDocument();
    expect(screen.queryByText('Gurdwara Singh Sabha Milton')).not.toBeInTheDocument();
    expect(screen.getByText('7035, Sixth Line, Milton')).toBeInTheDocument();
    expect(screen.getByRole('banner', { name: 'Gurdwara broadcast header' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Live Gurbani broadcast footer' })).toBeInTheDocument();
  });

  test('applies independent language sizes and selected logo colors', () => {
    window.history.replaceState({}, '', '/stream-overlay?lang=gpe&sizeg=120&sizep=80&sizee=60&brandBlue=%23004080&brandOrange=%23F89820');
    render(<StreamOverlayPage />);
    expect(screen.getByRole('banner', { name: 'Gurdwara broadcast header' })).toHaveStyle({ backgroundColor: '#004080' });
    expect(screen.getByRole('main', { name: 'Live Gurbani broadcast overlay' })).toHaveStyle({ '--gurbani-size': '1.2', '--punjabi-size': '0.8', '--english-size': '0.6' });
  });

  test('shows header and compact bilingual ticker without scripture when idle', () => {
    useRecitationLive.mockReturnValue({ session: null });
    useRecitationText.mockReturnValue({ lines: [] });
    window.history.replaceState({}, '', '/stream-overlay?announcement=1&message=Welcome&messagepa=ਜੀ%20ਆਇਆਂ%20ਨੂੰ');
    render(<StreamOverlayPage />);
    expect(screen.getByRole('banner', { name: 'Gurdwara broadcast header' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Announcement ticker' })).toHaveClass('stream-overlay-footer-ticker-only');
    expect(screen.getByLabelText('Footer announcement ticker')).toBeInTheDocument();
    expect(screen.queryByText('Gurbani preview')).not.toBeInTheDocument();
  });
});