import { useAuth } from "../hooks/auth";
import { useAds } from "../hooks/search";
import { useApplications } from "../hooks/applications";
import { useBookmarks, useCommentLikes, usePosts } from "../hooks/posts";
import { useInteractions } from "../hooks/posts/useInteractions";
import { createProfileIfNotExists } from "./profileUtils";
import { Ad, Application, Post, Profile } from "../types";
import { UserType } from "../types/enums";
import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { supabase, testSupabaseConnection } from "./supabase";

interface BookmarkState {
  loading: boolean;
  error: string | null;
  isBookmarked: boolean;
}

interface AppContextType {
  user: any | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error?: any; data?: any }>;
  signUp: (
    email: string,
    password: string,
    username: string,
    name: string,
    surname: string
  ) => Promise<{ error?: any; data?: any }>;
  signOut: () => Promise<any>;
  refreshAuth: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<any>;
  posts: Post[];
  postsLoading: boolean;
  postsError: string | null;
  postsRefreshing: boolean;
  refreshPosts: () => Promise<void>;
  clearPostsError: () => void;
  applications: Application[];
  applicationsLoading: boolean;
  applicationsError: string | null;
  fetchApplications: () => Promise<void>;
  addApplication: (applicationData: Partial<Application>) => Promise<any>;
  ads: Ad[];
  adsLoading: boolean;
  adsError: string | null;
  fetchAds: (status?: any) => Promise<void>;
  addAd: (adData: Partial<Ad>) => Promise<any>;
  recordAdImpression: (adId: string, userId: string) => Promise<any>;
  bookmarks: string[];
  bookmarksLoading: boolean;
  bookmarksError: string | null;
  toggleBookmark: (postId: string) => Promise<any>;
  initializePost: (postId: string) => Promise<any>;
  bookmarkStates: Record<string, BookmarkState>;
  commentLikesLoading: boolean;
  commentLikesError: string | null;
  isCommentLiked: (commentId: string) => Promise<boolean>;
  likeComment: (commentId: string) => Promise<any>;
  unlikeComment: (commentId: string) => Promise<any>;
  toggleCommentLike: (commentId: string) => Promise<any>;
  getCommentLikeCount: (commentId: string) => Promise<number>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const postsHook = usePosts();
  const applicationsHook = useApplications(auth.user?.id);
  const adsHook = useAds();
  const bookmarksHook = useBookmarks();
  const commentLikesHook = useCommentLikes();
  const interactionsHook = useInteractions();
  const [authError, setAuthError] = React.useState<string | null>(null);

  useEffect(() => {
    if (auth.user?.id) {
      const initializeData = async () => {
        try {
          const connectionOk = await testSupabaseConnection();
          if (!connectionOk) {
            console.warn(
              "Supabase connection probe failed during app initialization; continuing with feature fetches."
            );
          }

          await Promise.all([
            postsHook.refresh(),
            applicationsHook.fetchApplications(),
            adsHook.fetchAds(),
          ]);
          setAuthError(null);
        } catch (error) {
          console.error("Error initializing data:", error);
        }
      };

      void initializeData();
    }
  }, [auth.user?.id]);

  const value: AppContextType = {
    user: auth.user,
    profile: auth.profile,
    isAuthenticated: !!auth.user,
    isLoading: auth.loading,
    authError,
    signIn: async (email: string, password: string) => {
      try {
        setAuthError(null);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setAuthError(error.message);
        }
        return { data, error };
      } catch (error: any) {
        const errorMessage = error.message || "Sign in failed";
        setAuthError(errorMessage);
        return { error: { message: errorMessage } };
      }
    },
    signUp: async (
      email: string,
      password: string,
      username: string,
      name: string,
      surname: string
    ) => {
      try {
        setAuthError(null);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              name,
              surname,
            },
          },
        });
        if (error) {
          setAuthError(error.message);
          return { data, error };
        }

        let authData = data;

        if (data?.user?.id && !data.session) {
          const {
            data: signInData,
            error: signInError,
          } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            console.warn(
              "Signup succeeded but automatic post-signup sign-in did not complete:",
              signInError.message
            );
          } else if (signInData?.session) {
            authData = {
              ...data,
              session: signInData.session,
              user: signInData.user ?? data.user,
            };
          }
        }

        if (authData?.user?.id) {
          const syncedProfile = await createProfileIfNotExists(authData.user.id, {
            username,
            name,
            surname,
            user_type: UserType.User,
          });

          if (!syncedProfile) {
            console.warn(
              "Profile sync after signup did not complete immediately"
            );
          }
        }

        return { data: authData, error };
      } catch (error: any) {
        const errorMessage = error.message || "Sign up failed";
        setAuthError(errorMessage);
        return { error: { message: errorMessage } };
      }
    },
    signOut: auth.signOut,
    refreshAuth: async () => {
      try {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.error("Error refreshing auth:", error);
        }
      } catch (error) {
        console.error("Error refreshing auth:", error);
      }
    },
    updateProfile: auth.updateProfile,
    posts: postsHook.posts,
    postsLoading: postsHook.loading,
    postsError: postsHook.error,
    postsRefreshing: postsHook.refreshing,
    refreshPosts: async () => postsHook.refresh(),
    clearPostsError: postsHook.clearError,
    applications: applicationsHook.applications,
    applicationsLoading: applicationsHook.loading,
    applicationsError: applicationsHook.error,
    fetchApplications: applicationsHook.fetchApplications,
    addApplication: applicationsHook.addApplication,
    ads: adsHook.ads,
    adsLoading: adsHook.loading,
    adsError: adsHook.error,
    fetchAds: adsHook.fetchAds,
    addAd: adsHook.addAd,
    recordAdImpression: adsHook.recordAdImpression,
    bookmarks: [],
    bookmarksLoading: bookmarksHook.loading,
    bookmarksError: bookmarksHook.error,
    toggleBookmark: interactionsHook.toggleBookmark,
    initializePost: interactionsHook.initializePost,
    bookmarkStates: interactionsHook.bookmarkStates,
    commentLikesLoading: commentLikesHook.loading,
    commentLikesError: commentLikesHook.error,
    isCommentLiked: async (commentId: string) =>
      commentLikesHook.isLiked(commentId),
    likeComment: commentLikesHook.likeComment,
    unlikeComment: commentLikesHook.unlikeComment,
    toggleCommentLike: commentLikesHook.toggleCommentLike,
    getCommentLikeCount: async (commentId: string) =>
      commentLikesHook.getCommentLikeCount(commentId),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
