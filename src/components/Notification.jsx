
import React, { useEffect, useState } from 'react';

function Notification({ message, type = 'info', duration = 4000 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [display, setDisplay] = useState('none');

  useEffect(() => {
    if (message) {
      setDisplay('block');
      setTimeout(() => {
        setIsVisible(true);
      }, 10);

      // Only set a timeout to hide if duration is not 0 (persistent)
      if (duration !== 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            setDisplay('none');
          }, 500); // Match CSS transition duration
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      // If message becomes null, hide the notification immediately
      setIsVisible(false);
      setDisplay('none');
    }
  }, [message, duration]);

  // Determine the class name based on the type prop
  const notificationClass = `notification-banner notification-banner--${type}`;

  return (
    <div
      id="notification-banner"
      className={notificationClass}
      style={{
        display: display,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(-20px)',
      }}
    >
      {message}
    </div>
  );
}

export default Notification;
