import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';

import { supabase } from '../lib/supabaseClient';
import { clearInactivityTimestamp } from '../hooks/useInactivityLogout.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [business, setBusiness] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  /*
   * Every profile request receives a unique ID.
   *
   * If an older request finishes after a newer request,
   * its result is ignored.
   */
  const requestIdRef = useRef(0);

  /*
   * Prevent updates after the provider is unmounted.
   */
  const mountedRef = useRef(false);

  /*
   * During initial startup, auth events are temporarily
   * held until getSession() has completed.
   */
  const initializedRef = useRef(false);
  const pendingAuthEventRef = useRef(null);

  const clearUserData = useCallback(() => {
    setProfile(null);
    setBusiness(null);
    setPermissions([]);
    setProfileError(null);
  }, []);

  /*
   * Load the application user, business and permissions.
   */
  const loadProfile = useCallback(
    async (userId, requestId) => {
      if (!userId) {
        clearUserData();
        return false;
      }

      /*
       * Load user profile.
       */
      const {
        data: userRow,
        error: userError,
      } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      /*
       * Ignore stale request.
       */
      if (requestId !== requestIdRef.current) {
        return false;
      }

      if (userError || !userRow) {
        console.error(
          'Failed to load user profile:',
          userError
        );

        clearUserData();
        setProfileError(
          userError?.message ||
          'Your account profile could not be found. Please contact your administrator.'
        );
        return false;
      }

      // Clear any previous error once the profile loads successfully
      setProfileError(null);

      /*
       * Load business and permissions in parallel.
       */
      const [
        {
          data: businessRow,
          error: businessError,
        },
        {
          data: permissionRows,
          error: permissionError,
        },
      ] = await Promise.all([
        supabase
          .from('businesses')
          .select('*')
          .eq('id', userRow.business_id)
          .single(),

        supabase
          .from('role_permissions')
          .select('*')
          .eq('user_id', userId),
      ]);

      /*
       * Ignore stale request.
       */
      if (requestId !== requestIdRef.current) {
        return false;
      }

      if (businessError) {
        console.error(
          'Failed to load business:',
          businessError
        );
      }

      if (permissionError) {
        console.error(
          'Failed to load permissions:',
          permissionError
        );
      }

      /*
       * Only publish the data after all required
       * profile queries have finished.
       */
      setProfile(userRow);
      setBusiness(businessRow || null);
      setPermissions(permissionRows || []);

      return true;
    },
    [clearUserData]
  );

  /*
   * Apply a new authentication session.
   *
   * loading stays TRUE until the session's profile has
   * finished loading.
   */
  const applySession = useCallback(
    async (newSession) => {
      const requestId = ++requestIdRef.current;

      /*
       * While switching sessions, keep ProtectedRoute
       * in its loading state.
       */
      setLoading(true);

      /*
       * Set the new Supabase session.
       */
      setSession(newSession);

      /*
       * Immediately remove data belonging to the
       * previous authenticated user.
       */
      clearUserData();

      /*
       * Logged out.
       */
      if (!newSession?.user?.id) {
        setLoading(false);
        return;
      }

      /*
       * Load application-level user information.
       */
      await loadProfile(
        newSession.user.id,
        requestId
      );

      /*
       * Only the newest request is allowed to finish
       * the loading state.
       */
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    },
    [clearUserData, loadProfile]
  );

  /*
   * Authentication initialization and listener.
   */
  useEffect(() => {
    mountedRef.current = true;

    let subscription = null;

    /*
     * Handle an authentication event.
     */
    const handleAuthEvent = (
      event,
      newSession
    ) => {
      if (!mountedRef.current) {
        return;
      }

      /*
       * During initial startup, wait for getSession().
       */
      if (!initializedRef.current) {
        pendingAuthEventRef.current = {
          event,
          session: newSession,
        };

        return;
      }

      /*
       * TOKEN_REFRESHED does not require loading the
       * application profile again.
       *
       * The user/profile/business/permissions have not
       * changed simply because the access token changed.
       */
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        return;
      }

      /*
       * A brand-new, explicit sign-in is activity by definition.
       * Wipe any stale inactivity timestamp left over from a
       * previous session (e.g. the tab was closed before the
       * inactivity timer could fire) so useInactivityLogout doesn't
       * immediately judge this fresh login against an old, expired
       * timestamp and sign the user right back out.
       */
      if (
        (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') &&
        newSession?.user?.id
      ) {
        clearInactivityTimestamp(newSession.user.id);
      }

      /*
       * Process the event after Supabase's callback has
       * returned. This avoids doing async application
       * work directly inside onAuthStateChange().
       */
      setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }

        applySession(newSession);
      }, 0);
    };

    /*
     * Initialize authentication.
     */
    const initializeAuth = async () => {
      try {
        /*
         * Register the listener BEFORE getSession().
         *
         * This prevents an auth event from being missed
         * during startup.
         */
        const {
          data: listener,
        } = supabase.auth.onAuthStateChange(
          (event, newSession) => {
            handleAuthEvent(
              event,
              newSession
            );
          }
        );

        subscription = listener.subscription;

        /*
         * Get the currently persisted session.
         */
        const {
          data,
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!mountedRef.current) {
          return;
        }

        const initialSession =
          data?.session || null;

        /*
         * Apply the initial session and WAIT for the
         * profile/business/permissions.
         */
        await applySession(
          initialSession
        );

        if (!mountedRef.current) {
          return;
        }

        /*
         * Authentication initialization is now complete.
         */
        initializedRef.current = true;

        /*
         * There may have been an auth event while
         * getSession() was running.
         */
        const pending =
          pendingAuthEventRef.current;

        pendingAuthEventRef.current = null;

        if (pending) {
          const pendingUserId =
            pending.session?.user?.id || null;

          const initialUserId =
            initialSession?.user?.id || null;

          /*
           * If the pending event belongs to a different
           * user/session state, process it.
           *
           * If it is simply the same initial session,
           * don't load everything twice.
           */
          if (
            pending.event === 'SIGNED_OUT'
              ? initialUserId !== null
              : pending.event === 'PASSWORD_RECOVERY' ||
                pendingUserId !== initialUserId
          ) {
            if (
              (pending.event === 'SIGNED_IN' ||
                pending.event === 'PASSWORD_RECOVERY') &&
              pendingUserId
            ) {
              clearInactivityTimestamp(pendingUserId);
            }

            await applySession(
              pending.session
            );
          }
        }

        if (mountedRef.current) {
          setLoading(false);
        }
      } catch (error) {
        console.error(
          'Failed to initialize authentication:',
          error
        );

        if (mountedRef.current) {
          setSession(null);
          clearUserData();
          setLoading(false);
          initializedRef.current = true;
        }
      }
    };

    initializeAuth();

    /*
     * Cleanup.
     */
    return () => {
      mountedRef.current = false;

      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [applySession, clearUserData]);

  /*
   * Login.
   *
   * Do NOT call applySession() here.
   *
   * Supabase's auth listener is the source of truth.
   */
  const signIn = useCallback(
    async (email, password) => {
      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      return data;
    },
    []
  );

  /*
   * Logout.
   */
  const signOut = useCallback(
    async () => {
      const userId = session?.user?.id;

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // Clear this user's inactivity timestamp on every explicit
      // sign-out too, so it never lingers to affect a future login.
      clearInactivityTimestamp(userId);
    },
    [session]
  );

  /*
   * Manually refresh the current user's profile.
   *
   * This also uses the request ID system so an old
   * refresh cannot overwrite a newer session.
   */
  const refreshProfile = useCallback(
    async () => {
      const userId = session?.user?.id;

      if (!userId) {
        clearUserData();
        return;
      }

      const requestId =
        ++requestIdRef.current;

      setLoading(true);

      await loadProfile(
        userId,
        requestId
      );

      if (
        requestId ===
        requestIdRef.current
      ) {
        setLoading(false);
      }
    },
    [
      session,
      loadProfile,
      clearUserData,
    ]
  );

  /*
   * Permission helper.
   *
   * Owners automatically have full access.
   */
  const can = useCallback(
    (module, action = 'view') => {
      if (!profile) {
        return false;
      }

      if (profile.is_owner) {
        return true;
      }

      const permission =
        permissions.find(
          (row) =>
            row.module === module
        );

      if (!permission) {
        return false;
      }

      return !!permission[
        `can_${action}`
      ];
    },
    [profile, permissions]
  );

  const value = {
    session,
    user: session?.user || null,

    profile,
    business,
    permissions,

    loading,
    profileError,

    signIn,
    signOut,
    refreshProfile,
    applySession,

    can,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return ctx;
}