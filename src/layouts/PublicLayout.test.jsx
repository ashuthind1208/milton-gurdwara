import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicLayout from './PublicLayout';

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [] }),
  useMutation: () => ({ mutate: jest.fn(), reset: jest.fn(), isPending: false, isError: false, error: null })
}));

jest.mock('../components/layout/Navbar', () => {
  const { Link } = require('react-router-dom');
  return function MockNavbar() {
    return (
      <nav>
        <Link to="/loading">Open lazy page</Link>
        <audio data-testid="live-kirtan-audio" />
      </nav>
    );
  };
});

jest.mock('../components/layout/Footer', () => function MockFooter() {
  return <footer>Footer</footer>;
});

const SuspendedPage = () => {
  throw new Promise(() => {});
};

test('keeps the live kirtan audio mounted while a public route loads', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<div>Home page</div>} />
          <Route path="loading" element={<SuspendedPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

  const audio = screen.getByTestId('live-kirtan-audio');
  fireEvent.click(screen.getByRole('link', { name: 'Open lazy page' }));

  expect(await screen.findByText('Loading page...')).toBeInTheDocument();
  expect(screen.getByTestId('live-kirtan-audio')).toBe(audio);
});

test('shows the floating Ask a Granthi assistant without adding a navigation link', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<div>Home page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByRole('button', { name: 'Ask a Granthi Ji a question' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /ask a granthi/i })).not.toBeInTheDocument();
});