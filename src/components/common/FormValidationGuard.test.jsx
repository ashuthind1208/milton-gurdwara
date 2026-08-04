import { fireEvent, render, screen } from '@testing-library/react';
import FormValidationGuard from './FormValidationGuard';

describe('FormValidationGuard', () => {
  test('marks a missing mandatory field with an explanatory tooltip and clears it on input', () => {
    render(
      <>
        <FormValidationGuard />
        <form aria-label="Example form">
          <label>
            Full Name
            <input aria-label="Full Name" required />
          </label>
        </form>
      </>
    );

    const form = screen.getByRole('form', { name: 'Example form' });
    const input = screen.getByLabelText('Full Name');
    fireEvent.invalid(input);

    expect(form).toHaveClass('form-validation-attempted');
    expect(input).toHaveAttribute('data-validation-error', 'true');
    expect(input).toHaveAttribute('title', 'Full Name is required.');

    fireEvent.input(input, { target: { value: 'Harpreet Singh' } });

    expect(input).not.toHaveAttribute('data-validation-error');
    expect(input).not.toHaveAttribute('title');
    expect(input).toBeValid();
  });
});