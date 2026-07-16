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
  { date: '2026-01-03', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-01-05', title: 'Parkash Sri Guru Gobind Singh Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਗੋਬਿੰਦ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-01-17', title: 'Birthday Pyare Bhai Himmat Singh Ji', titlePa: 'ਜਨਮ ਪਿਆਰੇ ਭਾਈ ਹਿੰਮਤ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-01-19', title: 'Chabian da Morcha', titlePa: 'ਚਾਬੀਆਂ ਦਾ ਮੋਰਚਾ', type: 'Gurpurab' },
  { date: '2026-01-26', title: 'Birthday Baba Deep Singh Ji', titlePa: 'ਜਨਮ ਬਾਬਾ ਦੀਪ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-01-31', title: 'Parkash Sri Guru Har Rai Sahib Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਰਾਇ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-02-01', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-02-12', title: 'Birthday Bhagat Ravidas Ji', titlePa: 'ਜਨਮ ਭਗਤ ਰਵਿਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2026-03-03', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-03-14', title: 'Gurgaddi Sri Guru Har Rai Sahib Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਰਾਇ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-03-19', title: 'Joti Jot Sri Guru Hargobind Sahib Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਗੋਬਿੰਦ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-03-15', title: 'Delhi Fateh Bhai Baghel Singh', titlePa: 'ਦਿੱਲੀ ਫ਼ਤਹ ਭਾਈ ਬਘੇਲ ਸਿੰਘ', type: 'Gurpurab' },
  { date: '2026-03-25', title: 'Shaheedi Bhai Subeg Singh and Bhai Shahbaz Singh', titlePa: 'ਸ਼ਹੀਦੀ ਭਾਈ ਸੁਬੇਗ ਸਿੰਘ ਜੀ ਅਤੇ ਭਾਈ ਸ਼ਾਹਬਾਜ਼ ਸਿੰਘ ਜੀ', type: 'Shaheedi' },
  { date: '2026-04-01', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-04-13', title: 'Shaheedi Saka Vaisakhi 1978', titlePa: 'ਵੈਸਾਖੀ 1978 ਦਾ ਸ਼ਹੀਦੀ ਸਾਕਾ (ਸ੍ਰੀ ਅੰਮ੍ਰਿਤਸਰ)', type: 'Shaheedi' },
  { date: '2026-04-14', title: 'Khalsa Sajna Day (Vaisakhi)', titlePa: 'ਖ਼ਾਲਸਾ ਸਾਜਣਾ ਦਿਵਸ (ਵੈਸਾਖੀ)', type: 'Gurpurab' },
  { date: '2026-04-16', title: 'Gurgaddi Sri Guru Amar Das Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਅਮਰਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2026-04-16', title: 'Joti Jot Sri Guru Angad Dev Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਅੰਗਦ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2026-04-16', title: 'Gurgaddi Sri Guru Tegh Bahadur Sahib Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਤੇਗ਼ ਬਹਾਦਰ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-04-16', title: 'Joti Jot Sri Guru Harikrishan Sahib Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਕ੍ਰਿਸ਼ਨ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-04-18', title: 'Parkash Sri Guru Angad Dev Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਅੰਗਦ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2026-04-18', title: 'Parkash Sri Guru Tegh Bahadur Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਤੇਗ਼ ਬਹਾਦਰ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-04-21', title: 'Birthday Bhagat Dhanna Ji', titlePa: 'ਜਨਮ ਭਗਤ ਧੰਨਾ ਜੀ', type: 'Gurpurab' },
  { date: '2026-05-01', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-05-02', title: 'Parkash Sri Guru Arjan Dev Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2026-05-23', title: 'Parkash Sri Guru Amar Das Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਅਮਰਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2026-05-31', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-05-04', title: 'Shaheedi Chali Mukte', titlePa: 'ਸ਼ਹੀਦੀ ਚਾਲੀ ਮੁਕਤੇ (ਮੁਕਤਸਰ ਸਾਹਿਬ)', type: 'Shaheedi' },
  { date: '2026-05-17', title: 'Chhota Ghallughara', titlePa: 'ਛੋਟਾ ਘੱਲੂਘਾਰਾ (ਕਾਹਨੂੰਵਾਨ)', type: 'Shaheedi' },
  { date: '2026-05-22', title: 'Saka Paonta Sahib', titlePa: 'ਸਾਕਾ ਪਾਉਂਟਾ ਸਾਹਿਬ', type: 'Shaheedi' },
  { date: '2026-05-29', title: 'Sirhind Fateh Baba Banda Singh Ji Bahadur', titlePa: 'ਸਰਹਿੰਦ ਫ਼ਤਹ ਬਾਬਾ ਬੰਦਾ ਸਿੰਘ ਜੀ ਬਹਾਦਰ', type: 'Gurpurab' },
  { date: '2026-06-11', title: 'Gurgaddi Sri Guru Harigobind Sahib Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਗੋਬਿੰਦ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-06-29', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-06-01', title: 'Shaheedi Bhai Mehnga Singh Babbar', titlePa: 'ਸ਼ਹੀਦੀ ਭਾਈ ਮਹਿੰਗਾ ਸਿੰਘ ਬੱਬਰ', type: 'Shaheedi' },
  { date: '2026-06-04', title: 'Attack on Sri Akal Takht Sahib (1984)', titlePa: 'ਸ੍ਰੀ ਅਕਾਲ ਤਖ਼ਤ ਸਾਹਿਬ \'ਤੇ ਹਮਲਾ (1984)', type: 'Shaheedi' },
  { date: '2026-06-05', title: 'Birthday Pyare Bhai Mukhm Singh Ji', titlePa: 'ਜਨਮ ਪਿਆਰੇ ਭਾਈ ਮੁਹਕਮ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-06-06', title: 'Shaheedi Baba Jarnail Singh Ji Bhindranwale', titlePa: 'ਸ਼ਹੀਦੀ ਬਾਬਾ ਜਰਨੈਲ ਸਿੰਘ ਜੀ ਭਿੰਡਰਾਂਵਾਲੇ', type: 'Shaheedi' },
  { date: '2026-06-15', title: 'Beginning of Harh', titlePa: 'ਅਰੰਭ ਹਾੜ', type: 'Sangrand' },
  { date: '2026-06-16', title: 'Shaheedi Day Sri Guru Arjan Dev Ji', titlePa: 'ਸ਼ਹੀਦੀ ਦਿਵਸ ਸ੍ਰੀ ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ', type: 'Shaheedi' },
  { date: '2026-06-18', title: 'Birthday Pyare Bhai Sahib Singh Ji', titlePa: 'ਜਨਮ ਪਿਆਰੇ ਭਾਈ ਸਾਹਿਬ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-06-25', title: 'Shaheedi Baba Banda Singh Ji Bahadur', titlePa: 'ਸ਼ਹੀਦੀ ਬਾਬਾ ਬੰਦਾ ਸਿੰਘ ਜੀ ਬਹਾਦਰ', type: 'Shaheedi' },
  { date: '2026-06-29', title: 'Death of Raja Ranjit Singh', titlePa: 'ਦਿਹਾਂਤ ਰਾਜਾ ਰਣਜੀਤ ਸਿੰਘ', type: 'Shaheedi' },
  { date: '2026-06-29', title: 'Birthday Bhagat Kabeer Ji (2026)', titlePa: 'ਜਨਮ ਭਗਤ ਕਬੀਰ ਜੀ (2026)', type: 'Gurpurab' },
  { date: '2026-07-05', title: 'Parkash Sri Guru Hargobind Sahib Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਗੋਬਿੰਦ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-07-02', title: 'Foundation Day Sri Akal Takht Sahib', titlePa: 'ਸਿਰਜਣਾ ਦਿਵਸ ਸ੍ਰੀ ਅਕਾਲ ਤਖ਼ਤ ਸਾਹਿਬ', type: 'Shaheedi' },
  { date: '2026-07-14', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-07-16', title: 'Sangrand - Sawan starts', titlePa: 'ਸੰਗਰਾਂਦ - ਸਾਵਣ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-07-16', title: 'Shaheedi Diwas - Bhai Taru Singh Ji', titlePa: 'ਸ਼ਹੀਦੀ ਦਿਵਸ - ਭਾਈ ਤਾਰੂ ਸਿੰਘ ਜੀ', type: 'Shaheedi' },
  { date: '2026-07-21', title: 'Miri-Piri Day - Sri Guru Hargobind Sahib Ji', titlePa: 'ਮੀਰੀ-ਪੀਰੀ ਦਿਵਸ - ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਗੋਬਿੰਦ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-07-23', title: 'Parkash Sri Guru Harkrishan Sahib Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਕ੍ਰਿਸ਼ਨ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-07-09', title: 'Shaheedi Bhai Mani Singh Ji', titlePa: 'ਸ਼ਹੀਦੀ ਭਾਈ ਮਨੀ ਸਿੰਘ ਜੀ', type: 'Shaheedi' },
  { date: '2026-07-20', title: 'Death of Sheikh Fareed Ji', titlePa: 'ਅਕਾਲ ਚਲਾਣਾ ਸ਼ੇਖ਼ ਫ਼ਰੀਦ ਜੀ', type: 'Shaheedi' },
  { date: '2026-07-29', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-08-14', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-08-16', title: 'Sangrand - Bhadon starts', titlePa: 'ਸੰਗਰਾਂਦ - ਭਾਦੋਂ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-08-28', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-08-08', title: 'Morcha Guru Ka Bagh', titlePa: 'ਮੋਰਚਾ ਗੁਰੂ ਕਾ ਬਾਗ', type: 'Shaheedi' },
  { date: '2026-08-27', title: 'Birthday Pyare Bhai Daya Singh Ji', titlePa: 'ਜਨਮ ਪਿਆਰੇ ਭਾਈ ਦਯਾ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-08-30', title: 'Vivah Purab Sri Guru Nanak Dev Ji', titlePa: 'ਵਿਆਹ ਪੁਰਬ ਸ੍ਰੀ ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2026-08-30', title: 'Completion Day Sri Guru Granth Sahib Ji', titlePa: 'ਸੰਪੂਰਨਤਾ ਦਿਵਸ ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-08-30', title: 'Shaheedi Bhai Anokh Singh Babbar', titlePa: 'ਸ਼ਹੀਦੀ ਭਾਈ ਅਨੋਖ ਸਿੰਘ ਬੱਬਰ', type: 'Shaheedi' },
  { date: '2026-09-01', title: 'Shaheedi Diwas - Baba Deep Singh Ji Smagam', titlePa: 'ਸ਼ਹੀਦੀ ਦਿਵਸ - ਬਾਬਾ ਦੀਪ ਸਿੰਘ ਜੀ ਸਮਾਗਮ', type: 'Shaheedi' },
  { date: '2026-09-01', title: 'First Parkash Sri Guru Granth Sahib Ji', titlePa: 'ਪਹਿਲਾ ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-09-12', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-09-12', title: 'Saka Saragari', titlePa: 'ਸਾਕਾ ਸਾਰਾਗੜ੍ਹੀ', type: 'Shaheedi' },
  { date: '2026-09-15', title: 'Sangrand - Assu starts', titlePa: 'ਸੰਗਰਾਂਦ - ਅੱਸੂ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-09-16', title: 'Gurgaddi Sri Guru Ram Das Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਰਾਮਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2026-09-16', title: 'Joti Jot Sri Guru Amar Das Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਅਮਰਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2026-09-16', title: 'Gurgaddi Sri Guru Arjan Dev Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2026-09-16', title: 'Joti Jot Sri Guru Ram Das Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਰਾਮਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2026-09-18', title: 'Gurgaddi Sri Guru Angad Dev Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਅੰਗਦ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2026-09-22', title: 'Joti Jot Sri Guru Nanak Dev Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2026-09-26', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-10-09', title: 'Parkash Sri Guru Ram Das Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਰਾਮਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2026-10-11', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-10-15', title: 'Sangrand - Katak starts', titlePa: 'ਸੰਗਰਾਂਦ - ਕੱਤਕ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-10-01', title: 'Establishment Singh Sabha Laher', titlePa: 'ਸਥਾਪਨਾ ਸਿੰਘ ਸਭਾ ਲਹਿਰ', type: 'Gurpurab' },
  { date: '2026-10-28', title: 'Saka Panja Sahib', titlePa: 'ਸਾਕਾ ਪੰਜਾ ਸਾਹਿਬ', type: 'Shaheedi' },
  { date: '2026-10-31', title: 'Shaheedi Bhai Beant Singh', titlePa: 'ਸ਼ਹੀਦੀ ਭਾਈ ਬੇਅੰਤ ਸਿੰਘ', type: 'Shaheedi' },
  { date: '2026-10-20', title: 'Gurgaddi Sri Guru Harkrishan Sahib Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਕ੍ਰਿਸ਼ਨ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-10-20', title: 'Joti Jot Sri Guru Harirai Sahib Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਰਾਇ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-10-20', title: 'Gurgaddi Sri Guru Granth Sahib Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-10-21', title: 'Joti Jot Sri Guru Gobind Singh Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਗੋਬਿੰਦ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-10-21', title: 'Birthday Baba Buddha Ji (Kathunangal)', titlePa: 'ਜਨਮ ਬਾਬਾ ਬੁੱਢਾ ਜੀ (ਕੱਥੂਨੰਗਲ)', type: 'Gurpurab' },
  { date: '2026-10-21', title: 'Birthday Pyare Bhai Dharam Singh Ji', titlePa: 'ਜਨਮ ਪਿਆਰੇ ਭਾਈ ਧਰਮ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-10-26', title: 'Puranmashi (Full Moon)', titlePa: 'ਪੂਰਨਮਾਸ਼ੀ', type: 'Puranmashi' },
  { date: '2026-11-01', title: 'Birthday Mata Sahib Kaur Ji', titlePa: 'ਜਨਮ ਮਾਤਾ ਸਾਹਿਬ ਕੌਰ ਜੀ', type: 'Gurpurab' },
  { date: '2026-11-10', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-11-14', title: 'Sangrand - Maghar starts', titlePa: 'ਸੰਗਰਾਂਦ - ਮੱਘਰ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-11-08', title: 'Bandi Chhor Divas (2026)', titlePa: 'ਬੰਦੀ ਛੋੜ ਦਿਵਸ (2026)', type: 'Holiday' },
  { date: '2026-11-13', title: 'Shaheedi Baba Deep Singh Ji', titlePa: 'ਸ਼ਹੀਦੀ ਬਾਬਾ ਦੀਪ ਸਿੰਘ ਜੀ', type: 'Shaheedi' },
  { date: '2026-11-16', title: 'Shaheedi S: Kartar Singh Sarabha', titlePa: 'ਸ਼ਹੀਦੀ ਸ: ਕਰਤਾਰ ਸਿੰਘ ਸਰਾਭਾ', type: 'Shaheedi' },
  { date: '2026-11-20', title: 'Birthday Bhagat Namdev Ji', titlePa: 'ਜਨਮ ਭਗਤ ਨਾਮਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2026-11-26', title: 'Akal Chalana Bhai Mardana Ji', titlePa: 'ਅਕਾਲ ਚਲਾਣਾ ਭਾਈ ਮਰਦਾਨਾ ਜੀ', type: 'Shaheedi' },
  { date: '2026-11-27', title: 'Akal Chalana Baba Buddha Ji (Ramdas)', titlePa: 'ਅਕਾਲ ਚਲਾਣਾ ਬਾਬਾ ਬੁੱਢਾ ਜੀ (ਰਮਦਾਸ)', type: 'Shaheedi' },
  { date: '2026-11-24', title: 'Gurgaddi Sri Guru Gobind Singh Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਗੋਬਿੰਦ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-11-24', title: 'Shaheedi Sri Guru Tegh Bahadur Sahib Ji', titlePa: 'ਸ਼ਹੀਦੀ ਸ੍ਰੀ ਗੁਰੂ ਤੇਗ਼ ਬਹਾਦਰ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-11-24', title: 'Parkash Sri Guru Nanak Dev Ji (2026)', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ (2026)', type: 'Gurpurab' },
  { date: '2026-11-28', title: 'Birthday Sahibzada Baba Zorawar Singh Ji', titlePa: 'ਜਨਮ ਸਾਹਿਬਜ਼ਾਦਾ ਬਾਬਾ ਜ਼ੋਰਾਵਰ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-12-02', title: 'Shaheedi Baba Gurbakhsh Singh Ji', titlePa: 'ਸ਼ਹੀਦੀ ਬਾਬਾ ਗੁਰਬਖ਼ਸ਼ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-12-07', title: 'Shaheedi Diwas - Sahibzade', titlePa: 'ਸ਼ਹੀਦੀ ਦਿਵਸ - ਸਾਹਿਬਜ਼ਾਦੇ', type: 'Shaheedi' },
  { date: '2026-12-09', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-12-12', title: 'Birthday Sahibzada Baba Fateh Singh Ji', titlePa: 'ਜਨਮ ਸਾਹਿਬਜ਼ਾਦਾ ਬਾਬਾ ਫ਼ਤਹ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2026-12-14', title: 'Sangrand - Poh starts', titlePa: 'ਸੰਗਰਾਂਦ - ਪੋਹ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-12-20', title: 'Shaheedi Bhai Jivan Singh Ji (Bhai Jaita Ji)', titlePa: 'ਸ਼ਹੀਦੀ ਭਾਈ ਜੀਵਨ ਸਿੰਘ ਜੀ (ਭਾਈ ਜੈਤਾ ਜੀ)', type: 'Shaheedi' },
  { date: '2026-12-21', title: 'Shaheedi Vadde Sahibzade', titlePa: 'ਸ਼ਹੀਦੀ ਵੱਡੇ ਸਾਹਿਬਜ਼ਾਦੇ', type: 'Shaheedi' },
  { date: '2026-12-21', title: 'Shaheedi Jod-meela Chamkaur Sahib', titlePa: 'ਸ਼ਹੀਦੀ ਜੋੜ-ਮੇਲਾ ਚਮਕੌਰ ਸਾਹਿਬ', type: 'Shaheedi' },
  { date: '2026-12-22', title: 'Shaheedi Baba Sangat Singh Ji', titlePa: 'ਸ਼ਹੀਦੀ ਬਾਬਾ ਸੰਗਤ ਸਿੰਘ ਜੀ', type: 'Shaheedi' },
  { date: '2026-12-26', title: 'Shaheedi Chhote Sahibzade', titlePa: 'ਸ਼ਹੀਦੀ ਛੋਟੇ ਸਾਹਿਬਜ਼ਾਦੇ', type: 'Shaheedi' },
  { date: '2026-12-26', title: 'Shaheedi Mata Gujri Ji', titlePa: 'ਸ਼ਹੀਦੀ ਮਾਤਾ ਗੁਜਰੀ ਜੀ', type: 'Shaheedi' },
  { date: '2026-12-26', title: 'Shaheedi Jod-meela Fatehgarh Sahib', titlePa: 'ਸ਼ਹੀਦੀ ਜੋੜ-ਮੇਲਾ ਫ਼ਤਹਗੜ੍ਹ ਸਾਹਿਬ', type: 'Shaheedi' },
  { date: '2027-01-05', title: 'Parkash Sri Guru Gobind Singh Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਗੋਬਿੰਦ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2027-01-26', title: 'Birthday Baba Deep Singh Ji', titlePa: 'ਜਨਮ ਬਾਬਾ ਦੀਪ ਸਿੰਘ ਜੀ', type: 'Gurpurab' },
  { date: '2027-01-31', title: 'Parkash Sri Guru Har Rai Sahib Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਰਾਇ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2027-03-14', title: 'Gurgaddi Sri Guru Har Rai Sahib Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਰਾਇ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2027-03-19', title: 'Joti Jot Sri Guru Hargobind Sahib Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਗੋਬਿੰਦ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2027-02-08', title: 'Wadda Ghallughara', titlePa: 'ਵੱਡਾ ਘੱਲੂਘਾਰਾ (ਕੁੱਪ-ਰੋਹੀੜਾ)', type: 'Shaheedi' },
  { date: '2027-02-21', title: 'Saka Nankana Sahib', titlePa: 'ਸਾਕਾ ਨਨਕਾਣਾ ਸਾਹਿਬ', type: 'Shaheedi' },
  { date: '2027-02-21', title: 'Jaito da Morcha', titlePa: 'ਜੈਤੋ ਦਾ ਮੋਰਚਾ', type: 'Shaheedi' },
  { date: '2027-04-16', title: 'Gurgaddi Sri Guru Amar Das Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਅਮਰਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2027-04-16', title: 'Joti Jot Sri Guru Angad Dev Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਅੰਗਦ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2027-04-16', title: 'Gurgaddi Sri Guru Tegh Bahadur Sahib Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਤੇਗ਼ ਬਹਾਦਰ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2027-04-16', title: 'Joti Jot Sri Guru Harikrishan Sahib Ji', titlePa: 'ਜੋਤੀ-ਜੋਤਿ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਕ੍ਰਿਸ਼ਨ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2027-04-18', title: 'Parkash Sri Guru Angad Dev Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਅੰਗਦ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2027-04-18', title: 'Parkash Sri Guru Tegh Bahadur Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਤੇਗ਼ ਬਹਾਦਰ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2027-05-02', title: 'Parkash Sri Guru Arjan Dev Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ', type: 'Gurpurab' },
  { date: '2027-05-23', title: 'Parkash Sri Guru Amar Das Ji', titlePa: 'ਪ੍ਰਕਾਸ਼ ਸ੍ਰੀ ਗੁਰੂ ਅਮਰਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2027-06-11', title: 'Gurgaddi Sri Guru Harigobind Sahib Ji', titlePa: 'ਗੁਰਗੱਦੀ ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਗੋਬਿੰਦ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' }
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

  if (token.includes('gurpurab') || token.includes('holiday')) {
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
    acc[entry.date].push({
      title: entry.title,
      titlePa: entry.titlePa || entry.title,
      type: entry.type,
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
      titlePa: event.titlePa || event.title,
      type: event.type,
      date: event.date,
      dateLabel: formatDateLabel(event.dateObj),
      dateLabelPa: formatDateLabelPa(event.dateObj),
      nanakshahiLabel: nanakshahi.label,
      nanakshahiLabelPa: nanakshahi.labelPa
      });
    });
};
