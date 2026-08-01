export const getPhoneDigits = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);

export const formatTenDigitPhone = (value) => {
  const digits = getPhoneDigits(value);
  if (!digits) {
    return '';
  }
  if (digits.length <= 3) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const isTenDigitPhone = (value) => getPhoneDigits(value).length === 10;