import addressLookupService from './addressLookupService';

describe('addressLookupService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('requests Canadian addresses and normalizes suggestions', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        { place_id: 123, display_name: '7035 Sixth Line, Milton, Ontario, Canada' },
        { place_id: 124, display_name: '' }
      ]
    });

    const results = await addressLookupService.searchCanadianAddresses('7035 Sixth Line');

    expect(results).toEqual([
      { id: '123', label: '7035 Sixth Line, Milton, Ontario, Canada' }
    ]);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('countrycodes=ca'),
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    );
  });
});