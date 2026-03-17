import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { useAuthOperations } from './useAuthOperations';
import type { Profile } from '../../types';

// Supabase auth-js uses a storage-backed lock for auth token operations.
// In dev (and in apps that call `useAuth()` from multiple components), auth
// operations like `getSession()` can run concurrently and trip the lock timeout.
// Serialize auth calls across the JS runtime to avoid deadlocks/timeouts.
let authOpQueue: Promise<unknown> = Promise.resolve();
function runAuthOp<T>(op: () => Promise<T>): Promise<T> {
  const next = authOpQueue.then(op, op);
  // keep the queue alive even if op fails
  authOpQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const {
    fetchUserProfile,
    updateUserProfile,
    forceRefreshProfile,
    isProfileLoaded
  } = useAuthOperations();

  // Use refs to store the latest values to avoid dependency issues
  const userRef = useRef<User | null>(null);
  const fetchUserProfileRef = useRef(fetchUserProfile);

  // Update refs when values change
  useEffect(() => {
    userRef.current = user;
    fetchUserProfileRef.current = fetchUserProfile;
  });

  // Helper function to check if error is a connection timeout
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

  // Handle auth state changes
  const onAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    try {
      setError(null);

      if (event === 'SIGNED_IN' && newSession) {
        setSession(newSession);
        setUser(newSession.user);
        setLoading(false);

        // Fetch the user's profile if we have a user
        if (newSession.user) {
          setProfileLoading(true);
          const userProfile = await fetchUserProfileRef.current(newSession.user.id);
          if (userProfile) {
            setProfile(userProfile);
          }
          setProfileLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setError(null);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error in auth state change:', err);
      setError(err.message || 'Authentication error occurred');
      setProfileLoading(false);
      setLoading(false);
    }
  }, []); // Empty dependency array since we use refs

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session }, error: sessionError } = await runAuthOp(async () => {
          // Get initial session (serialized to avoid auth lock contention)
          return await supabase.auth.getSession();
        });

        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setError(sessionError.message);
          return;
        }

        if (session) {
          setSession(session);
          setUser(session.user);
          setLoading(false);

          // Fetch profile if we have a user
          if (session.user) {
            setProfileLoading(true);
            const userProfile = await fetchUserProfileRef.current(session.user.id);
            if (userProfile) {
              setProfile(userProfile);
            }
            setProfileLoading(false);
          }
        }
        else {
          setLoading(false);
        }
      } catch (err: any) {
        // Retry once if we hit Supabase auth lock contention
        if (isAuthLockTimeoutError(err)) {
          try {
            await sleep(600);
            const { data: { session }, error: sessionError } = await runAuthOp(async () => {
              return await supabase.auth.getSession();
            });
            if (sessionError) {
              console.error('Error getting session (after retry):', sessionError);
              setError(sessionError.message);
              return;
            }
            if (session) {
              setSession(session);
              setUser(session.user);
              setLoading(false);
              if (session.user) {
                setProfileLoading(true);
                const userProfile = await fetchUserProfileRef.current(session.user.id);
                if (userProfile) setProfile(userProfile);
                setProfileLoading(false);
              }
            } else {
              setLoading(false);
            }
            return;
          } catch (retryErr: any) {
            console.error('Error initializing auth (retry):', retryErr);
            setError(retryErr.message || 'Failed to initialize authentication');
            setLoading(false);
            return;
          }
        }

        console.error('Error initializing auth:', err);
        setError(err.message || 'Failed to initialize authentication');
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(onAuthStateChange);

    return () => {
      subscription.unsubscribe();
    };
  }, [onAuthStateChange]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setError(null);
      await supabase.auth.signOut();
    } catch (error: any) {
      console.error('Error signing out:', error);
      setError(error.message || 'Failed to sign out');
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user?.id) return null;

    try {
      setError(null);
      setProfileLoading(true);

      const updatedProfile = await updateUserProfile(user.id, updates);
      if (updatedProfile) {
        setProfile(updatedProfile);

        // Force refresh profile to ensure cache is updated
        const freshProfile = await forceRefreshProfile(user.id);
        if (freshProfile) {
          setProfile(freshProfile);
        }
      }
      return updatedProfile;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile');
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [user?.id, updateUserProfile, forceRefreshProfile]);

  // Force refresh profile (useful for components to call when they need fresh data)
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return null;

    try {
      setError(null);
      setProfileLoading(true);

      const freshProfile = await forceRefreshProfile(user.id);
      if (freshProfile) {
        setProfile(freshProfile);
      }
      return freshProfile;
    } catch (error: any) {
      console.error('Error refreshing profile:', error);
      setError(error.message || 'Failed to refresh profile');
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [user?.id, forceRefreshProfile]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    session,
    profile,
    loading,
    profileLoading,
    error,
    signOut,
    updateProfile,
    refreshProfile,
    clearError,
    isProfileLoaded: isProfileLoaded(),
    isConnectionTimeoutError,
  };
}
