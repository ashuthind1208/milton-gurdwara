import { act, renderHook, waitFor } from '@testing-library/react';
import recitationService from '../services/recitationService';
import { useRecitationLive } from './useRecitation';

jest.mock('../services/recitationService', () => ({ __esModule: true, default: { getState: jest.fn() } }));

describe('useRecitationLive connection state', () => {
  let eventSource;
  beforeEach(() => {
    recitationService.getState.mockResolvedValue({ session: null, last: null });
    eventSource = null;
    global.EventSource = jest.fn(() => {
      eventSource = { addEventListener: jest.fn(), close: jest.fn(), onopen: null, onerror: null };
      return eventSource;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test('reports connected on state data and reconnecting on SSE error', async () => {
    const { result, unmount } = renderHook(() => useRecitationLive());
    await waitFor(() => expect(result.current.connectionStatus).toBe('connected'));
    act(() => eventSource.onerror());
    expect(result.current.connectionStatus).toBe('reconnecting');
    act(() => eventSource.addEventListener.mock.calls[0][1]({ data: JSON.stringify({ session: { status: 'live' }, last: null }) }));
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.session.status).toBe('live');
    unmount();
  });
});
