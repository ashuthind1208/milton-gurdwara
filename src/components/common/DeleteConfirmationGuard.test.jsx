import { fireEvent, render, screen } from '@testing-library/react';
import DeleteConfirmationGuard from './DeleteConfirmationGuard';

const GuardHarness = ({ onDelete }) => (
  <main>
    <h1>Events</h1>
    <button type="button" aria-label="Delete event" onClick={onDelete}>Delete</button>
    <DeleteConfirmationGuard />
  </main>
);

describe('DeleteConfirmationGuard', () => {
  test('cancels or confirms a destructive action through the custom dialog', () => {
    const onDelete = jest.fn();
    render(<GuardHarness onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Are you sure you want to delete event from Events? This action cannot be undone.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
