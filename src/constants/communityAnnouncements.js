export const COMMUNITY_ANNOUNCEMENT_CATEGORIES = [
  { value: 'community-service', label: 'Community services / ਕਮਿਊਨਿਟੀ ਸੇਵਾਵਾਂ' },
  { value: 'celebration', label: 'Celebrations / ਖੁਸ਼ੀ ਦੇ ਸਮਾਗਮ' },
  { value: 'condolence', label: 'Condolences / ਸ਼ੋਕ ਸੁਨੇਹੇ' },
  { value: 'blood-drive', label: 'Blood drives / ਖੂਨਦਾਨ' },
  { value: 'school-education', label: 'School & education / ਸਕੂਲ ਅਤੇ ਸਿੱਖਿਆ' },
  { value: 'nonprofit-services', label: 'Non-profit services / ਗੈਰ-ਮੁਨਾਫ਼ਾ ਸੇਵਾਵਾਂ' },
  { value: 'newcomer-government-services', label: 'Newcomer & government services / ਨਵੇਂ ਆਏ ਅਤੇ ਸਰਕਾਰੀ ਸੇਵਾਵਾਂ' },
  { value: 'lost-found', label: 'Lost & found / ਗੁੰਮ ਹੋਈਆਂ ਚੀਜ਼ਾਂ' },
  { value: 'volunteer-seva', label: 'Volunteer & seva / ਸੇਵਾ ਅਤੇ ਵਲੰਟੀਅਰ' },
  { value: 'housing-rental', label: 'Housing, basement & rentals / ਘਰ, ਬੇਸਮੈਂਟ ਅਤੇ ਕਿਰਾਇਆ' },
  { value: 'other', label: 'Other community notice / ਹੋਰ ਕਮਿਊਨਿਟੀ ਸੁਨੇਹਾ' }
];

export const COMMUNITY_ANNOUNCEMENT_CATEGORY_LABELS = Object.fromEntries(
  COMMUNITY_ANNOUNCEMENT_CATEGORIES.map(({ value, label }) => [value, label])
);
