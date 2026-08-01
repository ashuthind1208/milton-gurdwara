import { fireEvent, render, screen } from '@testing-library/react';
import ZeffyDonationModal from './ZeffyDonationModal';

const formUrl = 'https://www.zeffy.com/embed/donation-form/help-us-build-our-gurdwara?modal=true';

describe('ZeffyDonationModal', () => {
  test('keeps the secure Zeffy form inside the website and closes on request', () => {
    const onClose = jest.fn();
    render(<ZeffyDonationModal isOpen formUrl={formUrl} onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'Donate with Zeffy' });
    const iframe = screen.getByTitle('Zeffy secure donation form');
    expect(dialog).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', formUrl);
    expect(iframe).toHaveAttribute('allow', 'payment');

    fireEvent.click(screen.getByRole('button', { name: 'Close Zeffy donation form' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not render the payment iframe while closed', () => {
    render(<ZeffyDonationModal isOpen={false} formUrl={formUrl} onClose={jest.fn()} />);
    expect(screen.queryByTitle('Zeffy secure donation form')).not.toBeInTheDocument();
  });
});
