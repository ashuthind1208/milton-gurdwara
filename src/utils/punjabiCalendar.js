const NANAKSHAHI_MONTH_STARTS = [
  { name: 'Chet', namePa: 'ਚੇਤ', month: 3, day: 14 },
  { name: 'Vaisakh', namePa: 'ਵੈਸਾਖ', month: 4, day: 14 },
  { name: 'Jeth', namePa: 'ਜੇਠ', month: 5, day: 15 },
  { name: 'Harh', namePa: 'ਹਾੜ', month: 6, day: 15 },
  { name: 'Sawan', namePa: 'ਸਾਵਣ', month: 7, day: 16 },
  { name: 'Bhadon', namePa: 'ਭਾਦੋਂ', month: 8, day: 16 },
  { name: 'Assu', namePa: 'ਅੱਸੂ', month: 9, day: 15 },
  { name: 'Katak', namePa: 'ਕੱਤਕ', month: 10, day: 15 },
  { name: 'Maghar', namePa: 'ਮੱਘਰ', month: 11, day: 14 },
  { name: 'Poh', namePa: 'ਪੋਹ', month: 12, day: 14 },
  { name: 'Magh', namePa: 'ਮਾਘ', month: 1, day: 13 },
  { name: 'Phagun', namePa: 'ਫੱਗਣ', month: 2, day: 12 }
];

const FIXED_OBSERVANCES = [
  { date: '2026-07-05', title: 'Foundation Stone of Sachkhand Sri Harimandir Sahib, Sri Amritsar (Golden Temple)', type: 'Celebration' },
  { date: '2026-07-09', title: 'Bhai Mani Singh Ji', type: 'Shaheedi' },
  { date: '2026-07-14', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2026-07-16', title: 'Bhai Taru Singh Ji', type: 'Shaheedi' },
  { date: '2026-07-24', title: 'Miri Piri Divas', type: 'Celebration' },
  { date: '2026-07-29', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2026-07-31', title: 'Sardar Udham Singh', type: 'Shaheedi' },
  { date: '2026-08-07', title: 'Guru HarKrishan Sahib Ji', type: 'Prakash' },
  { date: '2026-08-08', title: 'Morcha Guru ka Baag', type: 'Historical' },
  { date: '2026-08-12', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2026-08-28', title: 'Pyare Bhai Daya Singh Ji', type: 'Birth' },
  { date: '2026-08-28', title: 'Jorh Mela - Baba Bakala', type: 'Historical' },
  { date: '2026-08-28', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2026-08-30', title: 'Sampuranta Divas Sri Guru Granth Sahib Ji', type: 'Historical' },
  { date: '2026-09-09', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2026-09-12', title: '1st Prakash Sri Guru Granth Sahib Ji', type: 'Prakash' },
  { date: '2026-09-13', title: 'Guru Arjan Dev Ji', type: 'Gurgaddi' },
  { date: '2026-09-14', title: 'Guru Ram Das Ji', type: 'Joti Jot' },
  { date: '2026-09-18', title: 'Jorh Mela Gurdwara Kandh Sahib / Marriage of Guru Nanak Dev', type: 'Celebration' },
  { date: '2026-09-24', title: 'Guru Ram Das Ji', type: 'Gurgaddi' },
  { date: '2026-09-26', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2026-09-26', title: 'Guru Amar Das Ji', type: 'Joti Jot' },
  { date: '2026-10-01', title: 'Guru Angad Dev Ji', type: 'Gurgaddi' },
  { date: '2026-10-05', title: 'Guru Nanak Dev Ji', type: 'Joti Jot' },
  { date: '2026-10-06', title: 'Jorh Mela (Retirement) - Baba Budha Ji (Thatha)', type: 'Historical' },
  { date: '2026-10-07', title: 'Jorh Mela (Retirement) - Baba Budha Ji (Thatha)', type: 'Historical' },
  { date: '2026-10-10', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2026-10-10', title: 'Bhai Taru Singh Ji', type: 'Birth' },
  { date: '2026-10-20', title: 'Darbar Khalsa (Dussehra)', type: 'Celebration' },
  { date: '2026-10-23', title: 'Baba Budha Ji', type: 'Birth' },
  { date: '2026-10-23', title: 'Pyare Bhai Dharam Singh Ji', type: 'Birth' },
  { date: '2026-10-23', title: 'Passing of Jassa Singh Ahluwalia', type: 'Historical' },
  { date: '2026-10-26', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2026-10-27', title: 'Guru Ram Das Ji', type: 'Prakash' },
  { date: '2026-11-03', title: 'Guru HarKrishan Sahib Ji', type: 'Gurgaddi' },
  { date: '2026-11-03', title: 'Guru Har Rai Ji', type: 'Joti Jot' },
  { date: '2026-11-03', title: 'Mata Sahib Dev (Mother of Khalsa)', type: 'Birth' },
  { date: '2026-11-08', title: 'Bandi Chhor (Divali)', type: 'Holiday' },
  { date: '2026-11-09', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2026-11-11', title: 'Sri Guru Granth Sahib Ji (Nanded)', type: 'Gurgaddi' },
  { date: '2026-11-14', title: 'Sri Guru Gobind Singh Ji', type: 'Joti Jot' },
  { date: '2026-11-15', title: 'Baba Deep Singh Ji', type: 'Shaheedi' },
  { date: '2026-11-24', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2026-11-24', title: 'Guru Nanak Dev Ji', type: 'Prakash' },
  { date: '2026-11-28', title: 'Merging of Bhai Mardana Ji', type: 'Merging' },
  { date: '2026-11-30', title: 'Sahibzada Baba Joravar Singh Ji', type: 'Birth' },
  { date: '2026-12-08', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2026-12-12', title: 'Guru Gobind Singh Ji', type: 'Gurgaddi' },
  { date: '2026-12-13', title: 'Bhai Dyala, Mati Das & Sati Das Ji', type: 'Shaheedi' },
  { date: '2026-12-14', title: 'Guru Tegh Bahadur Sahib Ji', type: 'Shaheedi' },
  { date: '2026-12-14', title: 'Sahibzada Baba Fateh Singh Ji', type: 'Birth' },
  { date: '2026-12-14', title: 'Panj Piare - Guru Khalsa at Chamkaur Sahib', type: 'Gurgaddi' },
  { date: '2026-12-23', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2026-12-21', title: 'Leaving of Anandpur Sahib Fort', type: 'History' },
  { date: '2026-12-22', title: "Splitting of Guru's Family at Sirsa", type: 'Merging' },
  { date: '2026-12-22', title: 'Bhai Jivan Singh (Bhai Jaita Ji)', type: 'Shaheedi' },
  { date: '2026-12-23', title: 'Sahibzada Baba Ajit Singh Ji', type: 'Shaheedi' },
  { date: '2026-12-23', title: 'Sahibzada Baba Jujhar Singh Ji', type: 'Shaheedi' },
  { date: '2026-12-23', title: 'Saka Chamkaur Sahib Ji', type: 'Historical' },
  { date: '2026-12-24', title: 'Bhai Sangat Singh Ji', type: 'Shaheedi' },
  { date: '2026-12-28', title: 'Sahibzada Baba Jorawar Singh Ji', type: 'Shaheedi' },
  { date: '2026-12-28', title: 'Sahibzada Baba Fateh Singh Ji', type: 'Shaheedi' },
  { date: '2026-12-28', title: 'Mata Gujri Ji', type: 'Shaheedi' },
  { date: '2027-01-07', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2027-01-14', title: 'Foundation Stone of Sachkhand Sri Harimandir Sahib, Sri Amritsar (Golden Temple)', type: 'Celebration' },
  { date: '2027-01-14', title: 'Sri Muktsar Sahib (Maaghi)', type: 'Jor Mela' },
  { date: '2027-01-15', title: 'Sri Guru Gobind Singh Ji', type: 'Prakash' },
  { date: '2027-01-18', title: 'Pyare Bhai Himmat Singh Ji', type: 'Birth' },
  { date: '2027-01-20', title: 'Chabiyan Da Morcha, Sri Amritsar (Golden Temple)', type: 'Historical' },
  { date: '2027-01-22', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2027-01-27', title: 'Baba Deep Singh Ji', type: 'Birthday' },
  { date: '2027-02-06', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2027-02-09', title: 'Wadda Ghallughara (Kup Rohira - Sangrur)', type: 'Historical' },
  { date: '2027-02-11', title: 'Marriage of Guru Gobind Singh Ji & Mata Jito Ji (Guru Ka Lahore)', type: 'Celebration' },
  { date: '2027-02-11', title: 'Basant Panchmi', type: 'Historical' },
  { date: '2027-02-12', title: 'Sahibzada Baba Ajit Singh Ji', type: 'Birth' },
  { date: '2027-02-20', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2027-02-20', title: 'Bhagat Ravidas Ji', type: 'Birth' },
  { date: '2027-02-21', title: 'Jaito da Mela (Faridkot)', type: 'Historical' },
  { date: '2027-02-21', title: 'Saka Nankana Sahib', type: 'Historical' },
  { date: '2027-03-14', title: 'New Year (Bikrami Year 2082-83) / Nanakshahi Samvat 558 starts', type: 'Festival' },
  { date: '2027-03-14', title: 'Jathedar Akali Phula Singh Ji', type: 'Shaheedi' },
  { date: '2027-03-15', title: 'Sardar Baghel Singh conquering of Delhi', type: 'Historical' },
  { date: '2027-03-17', title: 'Sri Guru HarRai Sahib Ji', type: 'Gurgaddi' },
  { date: '2027-03-18', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2027-03-19', title: 'Guru Amar Das Sahib Ji', type: 'Gurgaddi' },
  { date: '2027-03-22', title: 'Guru Angad Dev Ji', type: 'Joti Jot' },
  { date: '2027-03-23', title: 'Guru Hargobind Sahib Ji', type: 'Joti Jot' },
  { date: '2027-03-23', title: 'Shaheedi Bhagat Singh', type: 'Shaheedi' },
  { date: '2027-03-25', title: 'Bhai Subheg Singh & Bhai Shabaz Singh', type: 'Shaheedi' },
  { date: '2027-04-01', title: 'Guru Tegh Bahadur Sahib Ji', type: 'Gurgaddi' },
  { date: '2027-04-01', title: 'Guru HarKrishan Sahib Ji', type: 'Joti Jot' },
  { date: '2027-04-02', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2027-04-07', title: 'Guru Tegh Bahadur Sahib Ji', type: 'Prakash' },
  { date: '2027-04-09', title: 'Guru Arjan Dev Ji', type: 'Prakash' },
  { date: '2027-04-09', title: 'Sahibzada Baba Jujhar Singh Ji', type: 'Birth' },
  { date: '2027-04-13', title: 'Sikh Dastaar Divas (Sikh Turban Day)', type: 'Celebration' },
  { date: '2027-04-14', title: 'Khalsa Saajna Divas (Creation of Khalsa)', type: 'Celebration' },
  { date: '2027-04-17', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2027-04-18', title: 'Guru Angad Dev Ji', type: 'Prakash' },
  { date: '2027-04-21', title: 'Bhagat Dhanna Ji', type: 'Birth' },
  { date: '2027-04-30', title: 'Guru Amar Das Sahib Ji', type: 'Prakash' },
  { date: '2027-05-01', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2027-05-04', title: 'Sri Muktsar Sahib ~ Jorh Mela', type: 'Shaheedi' },
  { date: '2027-05-05', title: 'Jassa Singh Ramgarhia', type: 'Birthday' },
  { date: '2027-05-12', title: 'Victory at Sirhind (Banda Bahadur & Baba Deep Singh)', type: 'Historical' },
  { date: '2027-05-16', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2027-05-17', title: 'Chhota GhaluGhara (Gurdaspur)', type: 'Historical' },
  { date: '2027-05-19', title: 'Jassa Singh Ahluwalia', type: 'Birthday' },
  { date: '2027-06-15', title: 'Masya (new moon)', type: 'Masya' },
  { date: '2027-06-18', title: 'Guru Arjan Dev Ji', type: 'Shaheedi' },
  { date: '2027-06-18', title: 'Pyare Bhai Sahib Singh Ji', type: 'Birth' },
  { date: '2027-06-25', title: 'Banda Singh Bahadur', type: 'Shaheedi' },
  { date: '2027-06-29', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
  { date: '2027-06-29', title: 'Bhagat Kabir Ji', type: 'Birthday' },
  { date: '2027-06-30', title: 'Guru Hargobind Sahib Ji', type: 'Prakash' }
];

const DAY_MS = 24 * 60 * 60 * 1000;
const GURMUKHI_DIGITS = ['੦', '੧', '੨', '੩', '੪', '੫', '੬', '੭', '੮', '੯'];
const WEEK_DAYS = 7;

const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseAsLocalDate = (value) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'string') {
    const match = value.match(ISO_DATE_ONLY_PATTERN);
    if (match) {
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const day = Number(match[3]);
      return new Date(year, monthIndex, day);
    }
  }

  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toDateOnly = (value) => {
  return parseAsLocalDate(value);
};

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (date) => new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric'
}).format(date);

const formatDateLabelPa = (date) => {
  const day = date.getDate();
  const month = date.toLocaleString('en-CA', { month: 'short' });
  return `${toGurmukhiNumber(day)} ${month}`;
};

const hasGurmukhiScript = (value = '') => /[\u0A00-\u0A7F]/.test(String(value));

const transliterateTitleToGurmukhi = (value = '') => {
  const text = String(value || '').trim();
  if (!text || hasGurmukhiScript(text)) {
    return text;
  }

  const replacements = [
    ['Sahibzada Baba Joravar Singh Ji', 'ਸਾਹਿਬਜ਼ਾਦਾ ਬਾਬਾ ਜ਼ੋਰਾਵਰ ਸਿੰਘ ਜੀ'],
    ['Sahibzada Baba Fateh Singh Ji', 'ਸਾਹਿਬਜ਼ਾਦਾ ਬਾਬਾ ਫਤਹ ਸਿੰਘ ਜੀ'],
    ['Sahibzada Baba Ajit Singh Ji', 'ਸਾਹਿਬਜ਼ਾਦਾ ਬਾਬਾ ਅਜੀਤ ਸਿੰਘ ਜੀ'],
    ['Sahibzada Baba Jujhar Singh Ji', 'ਸਾਹਿਬਜ਼ਾਦਾ ਬਾਬਾ ਜੁਝਾਰ ਸਿੰਘ ਜੀ'],
    ['Bhai Jivan Singh (Bhai Jaita Ji)', 'ਭਾਈ ਜੀਵਨ ਸਿੰਘ (ਭਾਈ ਜੈਤਾ ਜੀ)'],
    ['Bhai Mani Singh Ji', 'ਭਾਈ ਮਨੀ ਸਿੰਘ ਜੀ'],
    ['Bhai Taru Singh Ji', 'ਭਾਈ ਤਾਰੂ ਸਿੰਘ ਜੀ'],
    ['Bhai Deep Singh Ji', 'ਭਾਈ ਦੀਪ ਸਿੰਘ ਜੀ'],
    ['Baba Deep Singh Ji', 'ਬਾਬਾ ਦੀਪ ਸਿੰਘ ਜੀ'],
    ['Guru Nanak Dev Ji', 'ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ'],
    ['Guru Gobind Singh Ji', 'ਗੁਰੂ ਗੋਬਿੰਦ ਸਿੰਘ ਜੀ'],
    ['Guru HarKrishan Sahib Ji', 'ਗੁਰੂ ਹਰਿਕ੍ਰਿਸ਼ਨ ਸਾਹਿਬ ਜੀ'],
    ['Guru Har Rai Ji', 'ਗੁਰੂ ਹਰਿਰਾਇ ਜੀ'],
    ['Guru Har Rai Sahib Ji', 'ਗੁਰੂ ਹਰਿਰਾਇ ਸਾਹਿਬ ਜੀ'],
    ['Guru Hargobind Sahib Ji', 'ਗੁਰੂ ਹਰਿਗੋਬਿੰਦ ਸਾਹਿਬ ਜੀ'],
    ['Guru Tegh Bahadur Sahib Ji', 'ਗੁਰੂ ਤੇਗ਼ ਬਹਾਦਰ ਸਾਹਿਬ ਜੀ'],
    ['Guru Angad Dev Ji', 'ਗੁਰੂ ਅੰਗਦ ਦੇਵ ਜੀ'],
    ['Guru Amar Das Sahib Ji', 'ਗੁਰੂ ਅਮਰ ਦਾਸ ਸਾਹਿਬ ਜੀ'],
    ['Guru Arjan Dev Ji', 'ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ'],
    ['Guru Ram Das Ji', 'ਗੁਰੂ ਰਾਮ ਦਾਸ ਜੀ'],
    ['Sri Guru Granth Sahib Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ'],
    ['Mata Sahib Dev', 'ਮਾਤਾ ਸਾਹਿਬ ਦੇਵ'],
    ['Mata Sahib Kaur Ji', 'ਮਾਤਾ ਸਾਹਿਬ ਕੌਰ ਜੀ'],
    ['Mata Gujri Ji', 'ਮਾਤਾ ਗੁਜਰੀ ਜੀ'],
    ['Pyare Bhai Himmat Singh Ji', 'ਪਿਆਰੇ ਭਾਈ ਹਿੰਮਤ ਸਿੰਘ ਜੀ'],
    ['Pyare Bhai Daya Singh Ji', 'ਪਿਆਰੇ ਭਾਈ ਦਇਆ ਸਿੰਘ ਜੀ'],
    ['Pyare Bhai Sahib Singh Ji', 'ਪਿਆਰੇ ਭਾਈ ਸਾਹਿਬ ਸਿੰਘ ਜੀ'],
    ['Pyare Bhai Dharam Singh Ji', 'ਪਿਆਰੇ ਭਾਈ ਧਰਮ ਸਿੰਘ ਜੀ'],
    ['Pyare Bhai Mohkam Singh Ji', 'ਪਿਆਰੇ ਭਾਈ ਮੋਹਕਮ ਸਿੰਘ ਜੀ'],
    ['Bhagat Ravidas Ji', 'ਭਗਤ ਰਵਿਦਾਸ ਜੀ'],
    ['Bhagat Kabir Ji', 'ਭਗਤ ਕਬੀਰ ਜੀ'],
    ['Bhagat Dhanna Ji', 'ਭਗਤ ਧੰਨਾ ਜੀ'],
    ['Jorh Mela', 'ਜੋੜ ਮੇਲਾ'],
    ['Masya (new moon)', 'ਮੱਸਿਆ (ਨਵਾਂ ਚੰਨ)'],
    ['Masya (Maseya)', 'ਮੱਸਿਆ'],
    ['Puranmaasi (full moon)', 'ਪੂਰਨਮਾਸ਼ੀ'],
    ['Puranmashi (Full Moon)', 'ਪੂਰਨਮਾਸ਼ੀ'],
    ['New Year (Bikrami Year 2082-83) / Nanakshahi Samvat 558 starts', 'ਨਵਾਂ ਸਾਲ (ਬਿਕਰਮੀ ਸਾਲ ੨੦੮੨-੮੩) / ਨਾਨਕਸ਼ਾਹੀ ਸੰਮਤ ੫੫੮ ਸ਼ੁਰੂ'],
    ['Bandi Chhor (Divali)', 'ਬੰਦੀ ਛੋੜ (ਦੀਵਾਲੀ)'],
    ['Khalsa Saajna Divas (Creation of Khalsa)', 'ਖ਼ਾਲਸਾ ਸਾਜਣਾ ਦਿਵਸ (ਖ਼ਾਲਸਾ ਦੀ ਸਿਰਜਣਾ)'],
    ['Sikh Dastaar Divas (Sikh Turban Day)', 'ਸਿੱਖ ਦਸਤਾਰ ਦਿਵਸ (ਸਿੱਖ ਪੱਗੜੀ ਦਿਵਸ)'],
    ['Celebration', 'ਸਮਾਗਮ'],
    ['Historical', 'ਇਤਿਹਾਸਕ'],
    ['Festival', 'ਤਿਉਹਾਰ'],
    ['Shaheedi', 'ਸ਼ਹੀਦੀ'],
    ['Prakash', 'ਪ੍ਰਕਾਸ਼'],
    ['Birthday', 'ਜਨਮ'],
    ['Birth', 'ਜਨਮ'],
    ['Gurgaddi', 'ਗੁਰਗੱਦੀ'],
    ['Joti Jot', 'ਜੋਤੀ ਜੋਤਿ'],
    ['Merging', 'ਅਕਾਲ ਚਲਾਣਾ'],
    ['Holiday', 'ਛੁੱਟੀ'],
    ['History', 'ਇਤਿਹਾਸਕ']
  ];

  let output = text;
  for (const [source, target] of replacements) {
    output = output.replaceAll(source, target);
  }

  return output;
};

const buildObservanceContext = (entry) => {
  const token = String(entry.type || '').toLowerCase();

  if (token.includes('masya')) {
    return {
      blurb: 'A reflective moon phase day for ardas, simran, humility, and renewed spiritual focus.',
      blurbPa: 'ਮੱਸਿਆ ਮਨਨ, ਅਰਦਾਸ, ਸਿਮਰਨ ਅਤੇ ਨਿਮਰਤਾ ਨਾਲ ਰੂਹਾਨੀ ਕੇਂਦ੍ਰਿਤਤਾ ਨਵੀਂ ਕਰਨ ਦਾ ਦਿਨ ਹੈ।'
    };
  }

  if (token.includes('puranmashi')) {
    return {
      blurb: 'A full moon day for reflection, gratitude, and calm remembrance in sangat and seva.',
      blurbPa: 'ਪੂਰਨਮਾਸ਼ੀ ਮਨਨ, ਸ਼ੁਕਰਾਨੇ ਅਤੇ ਸੰਗਤ ਤੇ ਸੇਵਾ ਵਿਚ ਸ਼ਾਂਤ ਯਾਦ ਦਾ ਦਿਨ ਹੈ।'
    };
  }

  if (token.includes('sangrand')) {
    return {
      blurb: 'Sangrand begins a new month, encouraging discipline, seva, gratitude, and spiritual reset.',
      blurbPa: 'ਸੰਗਰਾਂਦ ਨਵਾਂ ਮਹੀਨਾ ਸ਼ੁਰੂ ਕਰਦੀ ਹੈ, ਅਨੁਸ਼ਾਸਨ, ਸੇਵਾ, ਸ਼ੁਕਰਾਨਾ ਅਤੇ ਰੂਹਾਨੀ ਨਵੀਂ ਸ਼ੁਰੂਆਤ ਲਈ।'
    };
  }

  if (token.includes('shaheedi')) {
    return {
      blurb: 'A remembrance day honoring sacrifice, courage, faith, and steadfast commitment to Gurmat values.',
      blurbPa: 'ਸ਼ਹੀਦੀ ਦਿਨ ਕੁਰਬਾਨੀ, ਹਿੰਮਤ, ਵਿਸ਼ਵਾਸ ਅਤੇ ਗੁਰਮਤ ਮੁੱਲਾਂ ਨਾਲ ਅਡੋਲ ਨਿਭਾਅ ਦੀ ਯਾਦ ਹੈ।'
    };
  }

  if (token.includes('gurpurab') || token.includes('gurgaddi') || token.includes('joti jot') || token.includes('prakash') || token.includes('birth') || token.includes('birthday') || token.includes('holiday')) {
    return {
      blurb: 'A sacred Gurpurab observance inspiring sangat unity, kirtan devotion, seva, and gratitude today.',
      blurbPa: 'ਇਹ ਪਵਿੱਤਰ ਗੁਰਪੁਰਬ ਸੰਗਤ ਇਕਤਾ, ਕੀਰਤਨ ਭਗਤੀ, ਸੇਵਾ ਅਤੇ ਸ਼ੁਕਰਾਨੇ ਦੀ ਪ੍ਰੇਰਨਾ ਦਿੰਦਾ ਹੈ।'
    };
  }

  return {
    blurb: 'A meaningful Sikh calendar observance for remembrance, reflection, and values-led daily living.',
    blurbPa: 'ਇਹ ਸਿੱਖ ਕੈਲੰਡਰ ਅਨੁਸਾਰ ਅਰਥਪੂਰਨ ਦਿਹਾੜਾ ਹੈ, ਜੋ ਯਾਦ ਅਤੇ ਮਨਨ ਦੀ ਪ੍ਰੇਰਨਾ ਦਿੰਦਾ ਹੈ।'
  };
};

export const toGurmukhiNumber = (value) => String(value)
  .split('')
  .map((char) => (char >= '0' && char <= '9' ? GURMUKHI_DIGITS[Number(char)] : char))
  .join('');

const buildMonthStartCandidates = (year) => {
  const candidates = [];
  for (const monthInfo of NANAKSHAHI_MONTH_STARTS) {
    candidates.push({
      ...monthInfo,
      date: new Date(year, monthInfo.month - 1, monthInfo.day)
    });
  }
  return candidates;
};

export const getNanakshahiDate = (inputDate = new Date()) => {
  const target = toDateOnly(inputDate);
  const candidates = [
    ...buildMonthStartCandidates(target.getFullYear() - 1),
    ...buildMonthStartCandidates(target.getFullYear()),
    ...buildMonthStartCandidates(target.getFullYear() + 1)
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let start = candidates[0];
  for (const candidate of candidates) {
    if (candidate.date.getTime() <= target.getTime()) {
      start = candidate;
    }
  }

  const daysSince = Math.floor((target.getTime() - start.date.getTime()) / DAY_MS);
  const chetStartCurrentYear = new Date(target.getFullYear(), 2, 14);
  const nanakshahiYear = target >= chetStartCurrentYear ? target.getFullYear() - 1468 : target.getFullYear() - 1469;

  return {
    day: daysSince + 1,
    month: start.name,
    monthPa: start.namePa,
    year: nanakshahiYear,
    label: `${daysSince + 1} ${start.name} ${nanakshahiYear} Nanakshahi`,
    labelPa: `${toGurmukhiNumber(daysSince + 1)} ${start.namePa} ${toGurmukhiNumber(nanakshahiYear)} ਨਾਨਕਸ਼ਾਹੀ`
  };
};

export const getNanakshahiMonthCalendar = (inputDate = new Date()) => {
  const target = toDateOnly(inputDate);
  const candidates = [
    ...buildMonthStartCandidates(target.getFullYear() - 1),
    ...buildMonthStartCandidates(target.getFullYear()),
    ...buildMonthStartCandidates(target.getFullYear() + 1)
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let monthStart = candidates[0];
  let nextMonthStart = candidates[candidates.length - 1];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const nextCandidate = candidates[index + 1] || candidates[index];

    if (candidate.date.getTime() <= target.getTime() && nextCandidate.date.getTime() > target.getTime()) {
      monthStart = candidate;
      nextMonthStart = nextCandidate;
      break;
    }
  }

  const totalDays = Math.max(1, Math.round((nextMonthStart.date.getTime() - monthStart.date.getTime()) / DAY_MS));
  const activeDate = getNanakshahiDate(target);
  const startWeekday = monthStart.date.getDay();
  const observancesByDate = FIXED_OBSERVANCES.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    const context = buildObservanceContext(entry);
    const occasion = entry.occasion || entry.type || 'Observance';
    acc[entry.date].push({
      title: entry.title,
      titlePa: entry.titlePa || transliterateTitleToGurmukhi(entry.title),
      type: entry.type,
      occasion,
      blurb: context.blurb,
      blurbPa: context.blurbPa
    });
    return acc;
  }, {});

  const cells = Array.from({ length: startWeekday }, () => null);

  for (let day = 1; day <= totalDays; day += 1) {
    const gregorianDate = new Date(monthStart.date.getTime() + ((day - 1) * DAY_MS));
    const dateKey = toDateKey(gregorianDate);
    const observances = observancesByDate[dateKey] || [];
    cells.push({
      day,
      dayPa: toGurmukhiNumber(day),
      gregorianDate,
      isToday: day === activeDate.day,
      observances,
      hasObservance: observances.length > 0
    });
  }

  while (cells.length % WEEK_DAYS !== 0) {
    cells.push(null);
  }

  const weeks = [];
  for (let index = 0; index < cells.length; index += WEEK_DAYS) {
    weeks.push(cells.slice(index, index + WEEK_DAYS));
  }

  return {
    month: activeDate.month,
    monthPa: activeDate.monthPa,
    year: activeDate.year,
    yearPa: toGurmukhiNumber(activeDate.year),
    currentDay: activeDate.day,
    currentDayPa: toGurmukhiNumber(activeDate.day),
    label: `${activeDate.month} ${activeDate.year}`,
    labelPa: `${activeDate.monthPa} ${toGurmukhiNumber(activeDate.year)}`,
    monthStartGregorian: new Date(monthStart.date.getTime()),
    nextMonthStartGregorian: new Date(nextMonthStart.date.getTime()),
    weeks
  };
};

export const getUpcomingPunjabiObservances = (daysAhead = 10, now = new Date()) => {
  const today = toDateOnly(now);
  const windowEnd = new Date(today.getTime() + daysAhead * DAY_MS);

  return FIXED_OBSERVANCES
    .map((event) => ({ ...event, dateObj: toDateOnly(event.date) }))
    .filter((event) => event.dateObj >= today && event.dateObj <= windowEnd)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
    .map((event) => {
      const nanakshahi = getNanakshahiDate(event.dateObj);
      return ({
      id: `${event.type}-${event.date}`,
      title: event.title,
      titlePa: event.titlePa || transliterateTitleToGurmukhi(event.title),
      type: event.type,
      occasion: event.occasion || event.type || 'Observance',
      date: event.date,
      dateLabel: formatDateLabel(event.dateObj),
      dateLabelPa: formatDateLabelPa(event.dateObj),
      nanakshahiLabel: nanakshahi.label,
      nanakshahiLabelPa: nanakshahi.labelPa
      });
    });
};
