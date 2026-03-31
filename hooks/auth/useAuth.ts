import { useState, useCallback, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../utils/supabase';
import { supabaseRequest } from '../../utils/supabaseRequest';
import { ensureUserProfile } from '../../utils/profileUtils';
import { useAuthOperations } from './useAuthOperations';
import type { Profile } from '../../types';

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  error: string | null;
  profileLoaded: boolean;
};

const initialAuthState: AuthState = {
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileLoading: false,
  error: null,
  profileLoaded: false,
};

let authState: AuthState = initialAuthState;
let authInitPromise: Promise<void> | null = null;
let authListenerBound = false;
let profileFetchPromise: Promise<Profile | null> | null = null;
let profileFetchUserId: string | null = null;
const listeners = new Set<(state: AuthState) => void>();

// Supabase auth-js uses a storage-backed lock for auth token operations.
// In dev, repeated `getSession()` calls from multiple mounted components can
// compete for that lock and throw noisy timeout/network-like errors.
let authOpQueue: Promise<unknown> = Promise.resolve();
function runAuthOp<T>(op: () => Promise<T>): Promise<T> {
  const next = authOpQueue.then(op, op);
  authOpQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const emitAuthState = () => {
  listeners.forEach((listener) => listener(authState));
};

const setAuthState = (patch: Partial<AuthState>) => {
  authState = {
    ...authState,
    ...patch,
  };
  emitAuthState();
};

const isConnectionTimeoutError = (error: any): boolean => {
  const errorMessage = error?.message?.toLowerCase() || '';
  return errorMessage.includes('upstream connect error') ||
    errorMessage.includes('connection timeout') ||
    errorMessage.includes('disconnect/reset before headers');
};

const isAuthLockTimeoutError = (err: any): boolean => {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('acquiring process lock') ||
    msg.includes('process lock') ||
    msg.includes('auth-token') ||
    msg.includes('lock:sb-')
  );
};

const fetchUserProfile = async (userId: string): Promise<Profile | null> => {
  if (profileFetchPromise && profileFetchUserId === userId) {
    return profileFetchPromise;
  }

  profileFetchUserId = userId;
  profileFetchPromise = (async () => {
    try {
      const { data: profile } = await supabaseRequest<any>(
        async () => {
          const { data, error, status } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          return { data, error, status };
        },
        { logTag: 'profiles:getForAuth' }
      );

      if (profile) {
        return profile;
      }

      console.warn('Profile not found, attempting to create one for user:', userId);
      return await ensureUserProfile(userId);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    } finally {
      profileFetchPromise = null;
      profileFetchUserId = null;
    }
  })();

  return profileFetchPromise;
};

const loadProfileForSession = async (session: Session | null) => {
  if (!session?.user) {
    setAuthState({
      profile: null,
      profileLoading: false,
      profileLoaded: false,
    });
    return;
  }

  setAuthState({
    profileLoading: true,
    error: null,
  });

  const profile = await fetchUserProfile(session.user.id);

  setAuthState({
    profile,
    profileLoading: false,
    profileLoaded: !!profile,
  });
};

const handleAuthStateChange = async (
  event: string,
  newSession: Session | null
) => {
  try {
    if (event === 'SIGNED_OUT') {
      setAuthState({
        user: null,
        session: null,
        profile: null,
        profileLoading: false,
        profileLoaded: false,
        error: null,
        loading: false,
      });
      return;
    }

    setAuthState({
      session: newSession,
      user: newSession?.user ?? null,
      loading: false,
      error: null,
    });

    if (newSession?.user) {
      await loadProfileForSession(newSession);
      return;
    }

    setAuthState({
      profile: null,
      profileLoading: false,
      profileLoaded: false,
    });
  } catch (err: any) {
    console.error('Error in auth state change:', err);
    setAuthState({
      error: err.message || 'Authentication error occurred',
      profileLoading: false,
      loading: false,
    });
  }
};

const initializeAuthStore = async () => {
  if (!authListenerBound) {
    authListenerBound = true;
    supabase.auth.onAuthStateChange((event, session) => {
      void handleAuthStateChange(event, session);
    });
  }

  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = (async () => {
    try {
      setAuthState({
        loading: true,
        error: null,
      });

      const { data: { session }, error: sessionError } = await runAuthOp(
        async () => await supabase.auth.getSession()
      );

      if (sessionError) {
        console.error('Error getting session:', sessionError);
        setAuthState({
          error: sessionError.message,
          loading: false,
        });
        return;
      }

      setAuthState({
        session,
        user: session?.user ?? null,
        loading: false,
      });

      if (session?.user) {
        await loadProfileForSession(session);
        return;
      }

      setAuthState({
        profile: null,
        profileLoading: false,
        profileLoaded: false,
      });
    } catch (err: any) {
      if (isAuthLockTimeoutError(err)) {
        try {
          await sleep(600);
          const { data: { session }, error: sessionError } = await runAuthOp(
            async () => await supabase.auth.getSession()
          );

          if (sessionError) {
            console.error('Error getting session (after retry):', sessionError);
            setAuthState({
              error: sessionError.message,
              loading: false,
            });
            return;
          }

          setAuthState({
            session,
            user: session?.user ?? null,
            loading: false,
          });

          if (session?.user) {
            await loadProfileForSession(session);
            return;
          }

          setAuthState({
            profile: null,
            profileLoading: false,
            profileLoaded: false,
          });
          return;
        } catch (retryErr: any) {
          console.error('Error initializing auth (retry):', retryErr);
          setAuthState({
            error: retryErr.message || 'Failed to initialize authentication',
            loading: false,
            profileLoading: false,
          });
          return;
        }
      }

      console.error('Error initializing auth:', err);
      setAuthState({
        error: err.message || 'Failed to initialize authentication',
        loading: false,
        profileLoading: false,
      });
    }
  })();

  return authInitPromise;
};

const subscribeToAuthState = (listener: (state: AuthState) => void) => {
  listeners.add(listener);
  listener(authState);

  return () => {
    listeners.delete(listener);
  };
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(authState);
  const {
    updateUserProfile,
    forceRefreshProfile,
  } = useAuthOperations();

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(setState);
    void initializeAuthStore();

    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    try {
      setAuthState({ error: null });
      await supabase.auth.signOut();
    } catch (error: any) {
      console.error('Error signing out:', error);
      setAuthState({
        error: error.message || 'Failed to sign out',
      });
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!authState.user?.id) return null;

    try {
      setAuthState({
        error: null,
        profileLoading: true,
      });

      const updatedProfile = await updateUserProfile(authState.user.id, updates);
      if (updatedProfile) {
        setAuthState({
          profile: updatedProfile,
          profileLoaded: true,
        });

        const freshProfile = await forceRefreshProfile(authState.user.id);
        if (freshProfile) {
          setAuthState({
            profile: freshProfile,
            profileLoaded: true,
          });
        }
      }

      return updatedProfile;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setAuthState({
        error: error.message || 'Failed to update profile',
      });
      return null;
    } finally {
      setAuthState({
        profileLoading: false,
      });
    }
  }, [forceRefreshProfile, updateUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (!authState.user?.id) return null;

    try {
      setAuthState({
        error: null,
        profileLoading: true,
      });

      const freshProfile = await forceRefreshProfile(authState.user.id);
      if (freshProfile) {
        setAuthState({
          profile: freshProfile,
          profileLoaded: true,
        });
      }

      return freshProfile;
    } catch (error: any) {
      console.error('Error refreshing profile:', error);
      setAuthState({
        error: error.message || 'Failed to refresh profile',
      });
      return null;
    } finally {
      setAuthState({
        profileLoading: false,
      });
    }
  }, [forceRefreshProfile]);

  const clearError = useCallback(() => {
    setAuthState({ error: null });
  }, []);

  return {
    user: state.user,
    session: state.session,
    profile: state.profile,
    loading: state.loading,
    profileLoading: state.profileLoading,
    error: state.error,
    signOut,
    updateProfile,
    refreshProfile,
    clearError,
    isProfileLoaded: state.profileLoaded,
    isConnectionTimeoutError,
  };
}
