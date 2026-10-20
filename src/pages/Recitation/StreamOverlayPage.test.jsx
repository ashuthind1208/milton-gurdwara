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
    useBranding.mockReturnValue({ branding: { organizationName: 'Gurdwara Singh Sabha Milton', primaryColor: '#0B4EA2', accentColor: '#F4A300', address: '7035, Sixth Line, Milton' }, logoSrc: '/logo.png' });
  });

  test('renders transparent header and full-width Gurbani footer', () => {
    render(<StreamOverlayPage />);
    expect(screen.getByText('Gurdwara Singh Sabha')).toBeInTheDocument();
    expect(screen.getByText('7035, Sixth Line, Milton')).toBeInTheDocument();
    expect(screen.getByText('ਗੁਰਬਾਣੀ ਦੀ ਪੰਕਤੀ')).toBeInTheDocument();
    expect(screen.getByText('ਪੰਜਾਬੀ ਅਰਥ')).toBeInTheDocument();
    expect(screen.getByText('English meaning')).toBeInTheDocument();
  });

  test('keeps header and ticker only when no recitation is live', () => {
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