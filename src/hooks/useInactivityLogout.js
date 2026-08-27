import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
];

export const getActivityKey = (userId) =>
  `last_activity_at_${userId}`;

// Call this whenever a user explicitly signs in or out, so a stale
// timestamp left over from a previous, already-ended session can never
// trigger an immediate false "inactivity" logout on the next login.
export function clearInactivityTimestamp(userId) {
  if (!userId) return;
  localStorage.removeItem(getActivityKey(userId));
}

// Signs the user out after `timeoutMs` of no activity.
// Works while the app is open and also checks elapsed inactivity
// when the browser/tab is reopened or becomes visible again.
export default function useInactivityLogout(timeoutMs = 600_000) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  // Prevent multiple logout calls from happening at once.
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (!session?.user?.id) {
      loggingOutRef.current = false;
      return undefined;
    }

    const userId = session.user.id;
    const activityKey = getActivityKey(userId);

    let timer = null;
    let cancelled = false;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const removeListeners = () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };

    const handleTimeout = async () => {
      // Don't allow multiple timeout events to start
      // multiple signOut() calls.
      if (loggingOutRef.current || cancelled) {
        return;
      }

      loggingOutRef.current = true;

      clearTimer();

      // Remove the timestamp for THIS user.
      localStorage.removeItem(activityKey);

      removeListeners();

      try {
        await signOut();
      } catch (error) {
        console.error(
          'Inactivity logout failed:',
          error
        );
      }

      // If the component/session changed while signOut
      // was running, don't perform another navigation.
      if (cancelled) {
        return;
      }

      navigate('/login', {
        replace: true,
        state: {
          message:
            'You were signed out after being inactive for a while.',
        },
      });
    };

    const resetTimer = () => {
      if (loggingOutRef.current || cancelled) {
        return;
      }

      const now = Date.now();

      localStorage.setItem(
        activityKey,
        now.toString()
      );

      clearTimer();

      timer = setTimeout(() => {
        handleTimeout();
      }, timeoutMs);
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState !== 'visible' ||
        loggingOutRef.current ||
        cancelled
      ) {
        return;
      }

      const lastActivity = Number(
        localStorage.getItem(activityKey)
      );

      // No timestamp means this is a fresh session.
      if (!lastActivity) {
        resetTimer();
        return;
      }

      const elapsed = Date.now() - lastActivity;

      if (elapsed >= timeoutMs) {
        handleTimeout();
        return;
      }

      // Continue only for the remaining time.
      clearTimer();

      const remainingTime = timeoutMs - elapsed;

      timer = setTimeout(() => {
        handleTimeout();
      }, remainingTime);
    };

    /*
     * ------------------------------------------------------------
     * INITIAL SESSION CHECK
     * ------------------------------------------------------------
     */

    const lastActivity = Number(
      localStorage.getItem(activityKey)
    );

    if (lastActivity) {
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= timeoutMs) {
        // The user really was inactive for the full timeout.
        handleTimeout();
        return undefined;
      }

      // Continue the existing inactivity period.
      const remainingTime = timeoutMs - elapsed;

      timer = setTimeout(() => {
        handleTimeout();
      }, remainingTime);
    } else {
      // New authenticated session.
      resetTimer();
    }

    /*
     * ------------------------------------------------------------
     * ACTIVITY LISTENERS
     * ------------------------------------------------------------
     */

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(
        eventName,
        resetTimer,
        {
          passive: true,
        }
      );
    });

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    /*
     * ------------------------------------------------------------
     * CLEANUP
     * ------------------------------------------------------------
     */

    return () => {
      cancelled = true;

      clearTimer();

      removeListeners();
    };
  }, [session?.user?.id, timeoutMs, signOut, navigate]);
}