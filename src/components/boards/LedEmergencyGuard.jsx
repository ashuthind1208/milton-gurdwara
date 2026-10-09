import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import LedEmergencyOverlay from './LedEmergencyOverlay';
import ledScreenService from '../../services/ledScreenService';

const LedEmergencyGuard = ({ children }) => {
  const [searchParams] = useSearchParams();
  const embedded = searchParams.get('embed') === '1';
  const { data: override } = useQuery({
    queryKey: ['led-emergency-override'],
    queryFn: ledScreenService.getOverride,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    retry: 1,
    enabled: !embedded
  });
  return <>{children}{embedded ? null : <LedEmergencyOverlay override={override} />}</>;
};

export default LedEmergencyGuard;
