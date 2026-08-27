import hukamnamaService from './hukamnamaService';

const lines = [
  { id: 'line-1', shabadId: '3DL', gurmukhi: 'First Shabad' },
  { id: 'line-2', shabadId: 'G2W', gurmukhi: 'Selected Shabad' },
  { id: 'line-3', shabadId: 'G2W', gurmukhi: 'Selected Shabad second line' },
  { id: 'line-4', shabadId: '0G7', gurmukhi: 'Last Shabad' }
];

describe('hukamnamaService Shabad selection', () => {
  test('groups Ang lines by Shabad ID in source order', () => {
    const options = hukamnamaService.getShabadOptions({ lines });

    expect(options.map((option) => option.id)).toEqual(['3DL', 'G2W', '0G7']);
    expect(options[1].firstLine).toBe('Selected Shabad');
    expect(options[1].lines).toHaveLength(2);
  });

  test('uses the first Shabad verse after structural heading lines', () => {
    const options = hukamnamaService.getShabadOptions({
      lines: [
        { id: 'heading', shabadId: 'CAF', lineType: 2, gurmukhi: 'ਧਨਾਸਰੀ ਮਹਲਾ ੫ ॥' },
        { id: 'verse', shabadId: 'CAF', lineType: 4, gurmukhi: 'ਸਗਲ ਮਨੋਰਥ ਪ੍ਰਭ ਤੇ ਪਾਏ ਕੰਠਿ ਲਾਇ ਗੁਰਿ ਰਾਖੇ ॥' }
      ]
    });

    expect(options[0].firstLine).toBe('ਸਗਲ ਮਨੋਰਥ ਪ੍ਰਭ ਤੇ ਪਾਏ ਕੰਠਿ ਲਾਇ ਗੁਰਿ ਰਾਖੇ ॥');
  });

  test('returns only selected Shabad lines when an ID is saved', () => {
    const selected = hukamnamaService.getSelectedShabadLines({
      lines,
      selectedShabadId: 'G2W'
    });

    expect(selected.map((line) => line.id)).toEqual(['line-2', 'line-3']);
  });

  test('prefers complete selected Shabad lines that span neighboring Angs', () => {
    const completeLines = [
      { id: 'previous-ang', shabadId: 'GZG', gurmukhi: 'Shabad begins' },
      { id: 'next-ang', shabadId: 'GZG', gurmukhi: 'Shabad continues' }
    ];

    expect(hukamnamaService.getSelectedShabadLines({
      lines: [completeLines[0]],
      selectedShabadId: 'GZG',
      selectedShabadLines: completeLines
    })).toEqual(completeLines);
  });

  test('keeps the full Ang for legacy entries without a selected ID', () => {
    expect(hukamnamaService.getSelectedShabadLines({ lines })).toEqual(lines);
  });
});