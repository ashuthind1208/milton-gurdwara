import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import hukamnamaService from '../services/hukamnamaService';
import { toLocalDateKey } from '../services/ledAnnouncementService';

// Today's hukamnama, following the date so a screen left on for days moves to the next day by itself.
const useDailyHukamnama = () => {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey());

  useEffect(() => {
    const timer = window.setInterval(() => setDateKey(toLocalDateKey()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['daily-hukamnama', dateKey],
    queryFn: () => hukamnamaService.getDailyHukamnama(dateKey).then((response) => response.data),
    refetchInterval: 300000,
    refetchIntervalInBackground: true
  });

  const entry = data?.entry || null;
  const lines = useMemo(() => hukamnamaService.getSelectedShabadLines(entry || {}), [entry]);

  return { entry, lines, hasHukamnama: Boolean(entry?.ang && lines.length > 0), isLoading };
};

export default useDailyHukamnama;
