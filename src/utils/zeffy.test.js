import { toZeffyEmbedUrl, withZeffyDonorDetails } from './zeffy';

describe('toZeffyEmbedUrl', () => {
  test('converts a public Zeffy campaign link to an embedded modal form', () => {
    expect(toZeffyEmbedUrl('https://www.zeffy.com/en-CA/donation-form/build-our-gurdwara'))
      .toBe('https://www.zeffy.com/embed/donation-form/build-our-gurdwara?modal=true');
  });

  test('preserves campaign query parameters and rejects non-Zeffy links', () => {
    expect(toZeffyEmbedUrl('https://www.zeffy.com/embed/donation-form/build-our-gurdwara?amount=25'))
      .toBe('https://www.zeffy.com/embed/donation-form/build-our-gurdwara?amount=25&modal=true');
    expect(toZeffyEmbedUrl('https://example.com/donation-form/build-our-gurdwara')).toBe('');
  });

  test('prefills the personal details accepted by Zeffy', () => {
    expect(withZeffyDonorDetails(
      'https://www.zeffy.com/en-CA/donation-form/build-our-gurdwara?amount=30&prefilled_email=old%40example.com',
      { donorName: 'Harjit Kaur Singh', donorEmail: 'harjit@example.com' }
    )).toBe(
      'https://www.zeffy.com/en-CA/donation-form/build-our-gurdwara?amount=30&email=harjit%40example.com&firstName=Harjit&lastName=Kaur+Singh'
    );
  });
});