const ADDRESS_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

const addressLookupService = {
  searchCanadianAddresses: async (query, options = {}) => {
    const normalizedQuery = String(query || '').trim();
    if (normalizedQuery.length < 3) {
      return [];
    }

    const searchParams = new URLSearchParams({
      q: normalizedQuery,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'ca',
      limit: '6'
    });
    const response = await fetch(`${ADDRESS_SEARCH_URL}?${searchParams.toString()}`, {
      signal: options.signal,
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Address suggestions are temporarily unavailable.');
    }

    const rows = await response.json();
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: String(row?.place_id || row?.osm_id || row?.display_name || ''),
      label: String(row?.display_name || '').trim()
    })).filter((row) => row.id && row.label);
  }
};

export default addressLookupService;