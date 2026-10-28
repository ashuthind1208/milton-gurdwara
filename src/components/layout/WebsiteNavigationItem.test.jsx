import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WebsiteNavigationItem from './WebsiteNavigationItem';

const item = { id: 'services', label: 'Services offered', path: '/bookings', children: [{ id: 'programs', label: 'Weekly programs', path: '/events' }] };
const setup = (props = {}) => render(<MemoryRouter><WebsiteNavigationItem item={item} {...props} /></MemoryRouter>);

test('opens desktop children on hover and keeps parent navigation available', () => {
  setup();
  expect(screen.queryByRole('link', { name: 'Weekly programs' })).not.toBeInTheDocument();
  const parent = screen.getByRole('link', { name: 'Services offered' });
  expect(parent).toHaveAttribute('href', '/bookings');
  fireEvent.mouseEnter(parent.closest('div').parentElement);
  expect(screen.getByRole('link', { name: 'Weekly programs' })).toHaveAttribute('href', '/events');
  fireEvent.mouseLeave(parent.closest('div').parentElement);
  expect(screen.queryByRole('link', { name: 'Weekly programs' })).not.toBeInTheDocument();
});

test('supports keyboard focus and Escape', () => {
  setup();
  fireEvent.focus(screen.getByRole('link', { name: 'Services offered' }));
  expect(screen.getByRole('link', { name: 'Weekly programs' })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('link', { name: 'Weekly programs' }), { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Services offered submenu' })).toHaveAttribute('aria-expanded', 'false');
});

test('expands mobile children on tap and closes drawer on navigation', async () => {
  const onNavigate = jest.fn();
  setup({ mobile: true, onNavigate });
  await userEvent.click(screen.getByRole('button', { name: 'Services offered submenu' }));
  await userEvent.click(screen.getByRole('link', { name: 'Weekly programs' }));
  expect(onNavigate).toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: 'Weekly programs' })).not.toBeInTheDocument();
});