const parseZeffyUrl = (value) => {
  const url = new URL(String(value || '').trim());
  const hostname = url.hostname.toLowerCase();
  if (hostname !== 'zeffy.com' && !hostname.endsWith('.zeffy.com')) {
    return null;
  }
  return url;
};

export const getZeffyDonationFormSlug = (value = '') => {
  try {
    const url = parseZeffyUrl(value);
    if (!url) {
      return '';
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const donationFormIndex = segments.indexOf('donation-form');
    return String(segments[donationFormIndex + 1] || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

export const withZeffyDonorDetails = (value = '', { donorName = '', donorEmail = '' } = {}) => {
  try {
    const url = parseZeffyUrl(value);
    if (!url) {
      return '';
    }

    const nameParts = String(donorName || '').trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');

    url.searchParams.delete('prefilled_email');
    if (donorEmail) {
      url.searchParams.set('email', String(donorEmail).trim());
    }
    if (firstName) {
      url.searchParams.set('firstName', firstName);
    }
    if (lastName) {
      url.searchParams.set('lastName', lastName);
    }
    return url.toString();
  } catch {
    return '';
  }
};

export const toZeffyEmbedUrl = (value = '') => {
  try {
    const url = parseZeffyUrl(value);
    if (!url) {
      return '';
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const donationFormIndex = segments.indexOf('donation-form');
    if (donationFormIndex < 0 || !segments[donationFormIndex + 1]) {
      return '';
    }

    url.pathname = `/embed/donation-form/${segments[donationFormIndex + 1]}`;
    url.searchParams.set('modal', 'true');
    return url.toString();
  } catch {
    return '';
  }
};