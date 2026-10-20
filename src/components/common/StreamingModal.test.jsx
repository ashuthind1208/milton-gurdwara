import { render, screen } from '@testing-library/react';
import StreamingModal from './StreamingModal';

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
});

test('custom public stream is embedded unchanged with an external-view link', () => {
  const source = 'https://example.org/player?broadcast=123#live';
  render(<StreamingModal open streams={[{ id: 'custom', title: 'Gurdwara broadcast', streamUrl: source, active: true }]} onClose={jest.fn()} />);
  expect(screen.getByTitle('Gurdwara broadcast')).toHaveAttribute('src', source);
  expect(screen.getByRole('link', { name: 'Open stream in a new tab' })).toHaveAttribute('href', source);
  expect(screen.queryByText('Tap for 50% sound')).not.toBeInTheDocument();
});