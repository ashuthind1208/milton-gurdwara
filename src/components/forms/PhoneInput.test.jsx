import { fireEvent, render, screen } from '@testing-library/react';
import PhoneInput from './PhoneInput';

describe('PhoneInput', () => {
  test('accepts digits only and formats exactly 10 numbers', () => {
    render(<PhoneInput aria-label="Phone" />);
    const input = screen.getByLabelText('Phone');

    expect(fireEvent.keyDown(input, { key: 'A' })).toBe(false);
    fireEvent.change(input, { target: { value: '905abc123456789' } });

    expect(input).toHaveValue('(905)-123-4567');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('maxlength', '14');
    expect(input).toBeValid();
  });

  test('rejects a partial phone number', () => {
    render(<PhoneInput aria-label="Phone" />);
    const input = screen.getByLabelText('Phone');

    fireEvent.change(input, { target: { value: '905123' } });

    expect(input).toHaveValue('(905)-123');
    expect(input).toBeInvalid();
  });
});