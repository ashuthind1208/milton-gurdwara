import { useEffect } from 'react';
import ledScreenService from '../services/ledScreenService';

const useLedScreenHeartbeat = (screenId, currentSlide, label) => {
  useEffect(() => {
    const send = () => ledScreenService.heartbeat({ screenId, label: label || screenId, currentSlide }).catch(() => {});
    send();
    const timer = window.setInterval(send, 30000);
    return () => window.clearInterval(timer);
  }, [screenId, currentSlide, label]);
};

export default useLedScreenHeartbeat;
