import { formatTenDigitPhone, getPhoneDigits, isTenDigitPhone } from './phone';

describe('phone formatting', () => {
  test('formats and limits a North American phone number to 10 digits', () => {
    expect(formatTenDigitPhone('905')).toBe('(905');
    expect(formatTenDigitPhone('905123')).toBe('(905)-123');
    expect(formatTenDigitPhone('905-123-456789')).toBe('(905)-123-4567');
    expect(formatTenDigitPhone('(905) ABC 123-4567')).toBe('(905)-123-4567');
    expect(getPhoneDigits('(905)-123-4567')).toBe('9051234567');
    expect(isTenDigitPhone('(905)-123-4567')).toBe(true);
    expect(isTenDigitPhone('(905)-123-456')).toBe(false);
  });
});