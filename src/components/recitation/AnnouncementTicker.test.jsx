import { render, screen } from '@testing-library/react';
import AnnouncementTicker from './AnnouncementTicker';

test('zero speed pauses ticker and zero font size is preserved', () => {
  render(<AnnouncementTicker english="Welcome" speed={0} fontSize={0} backgroundColor="#123456" color="#fedcba" />);
  expect(screen.getByLabelText('Footer announcement ticker')).toHaveStyle({ backgroundColor: '#123456', color: '#fedcba' });
  expect(screen.getByLabelText('Footer announcement ticker')).toHaveStyle({ fontSize: 'clamp(0px, 0vw, 0px)' });
  expect(screen.getByTestId('ticker-track')).toHaveStyle({ animationPlayState: 'paused' });
});

test('speeds above 100 are capped and missing speed runs by default', () => {
  const { rerender } = render(<AnnouncementTicker english="Welcome" speed={200} />);
  expect(screen.getByTestId('ticker-track')).toHaveStyle({ '--ticker-duration': '60.2s', animationPlayState: 'running' });
  rerender(<AnnouncementTicker english="Welcome" />);
  expect(screen.getByTestId('ticker-track')).toHaveStyle({ '--ticker-duration': '60.2s', animationPlayState: 'running' });
});