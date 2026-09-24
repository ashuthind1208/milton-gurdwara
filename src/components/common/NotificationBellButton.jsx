import { useCallback, useEffect, useState } from 'react';
import { BellAlertIcon, BellIcon } from '@heroicons/react/24/outline';
import {
  getExistingPushSubscription,
  getPushPermission,
  isPushSupported,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications
} from '../../services/pushNotificationService';

const NotificationBellButton = ({ className = '', iconClassName = 'h-3.5 w-3.5' }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isPushSupported()) return undefined;

    getExistingPushSubscription().then((subscription) => {
      if (!cancelled) setIsSubscribed(Boolean(subscription));
    }).catch(() => undefined);

    return () => { cancelled = true; };
  }, []);

  const toggleSubscription = useCallback(async () => {
    if (!isPushSupported() || isBusy) return;
    if (getPushPermission() === 'denied') {
      window.alert('Notifications are blocked for this site. Enable them in your browser or device settings to receive updates.');
      return;
    }
    setIsBusy(true);
    try {
      if (isSubscribed) {
        await unsubscribeFromPushNotifications();
        setIsSubscribed(false);
      } else {
        await subscribeToPushNotifications();
        setIsSubscribed(true);
      }
    } catch (error) {
      window.alert(error?.message || 'Unable to update notification preferences.');
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, isSubscribed]);

  if (!isPushSupported()) {
    return null;
  }

  const isBlocked = getPushPermission() === 'denied';
  const Icon = isSubscribed ? BellAlertIcon : BellIcon;

  return (
    <button
      type="button"
      onClick={toggleSubscription}
      disabled={isBusy}
      className={`${className} ${isBlocked ? 'opacity-50' : ''}`}
      aria-label={isSubscribed ? 'Turn off notifications' : 'Turn on notifications'}
      aria-pressed={isSubscribed}
      title={isBlocked ? 'Notifications are blocked in your browser settings' : (isSubscribed ? 'Notifications on' : 'Turn on notifications')}
    >
      <Icon className={iconClassName} />
    </button>
  );
};

export default NotificationBellButton;
