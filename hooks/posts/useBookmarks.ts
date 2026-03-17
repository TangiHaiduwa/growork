import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { supabaseRequest } from '@/utils/supabaseRequest';
import { useAuth } from '../auth/useAuth';
import { useInteractions } from './useInteractions';

export interface BookmarkedItem {
  id: string;
  type: 'post' | 'application';
  data: any;
  bookmarked_at: string;
}

export function useBookmarks() {
  const { user } = useAuth();
  const { toggleBookmark, bookmarkStates, initializePost } = useInteractions();

  const [bookmarkedItems, setBookmarkedItems] = useState<BookmarkedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all bookmarked posts
  const fetchBookmarkedPosts = useCallback(async () => {
    if (!user) return [];

    try {
      const { data: bookmarks } = await supabaseRequest<any[]>(
        async () => {
          const { data, error, status } = await supabase
            .from('bookmarks')
            .select('id, created_at, post_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          return { data, error, status };
        },
        { logTag: 'bookmarks:list' }
      );

      const postIds = [...new Set((bookmarks || []).map((bookmark) => bookmark.post_id).filter(Boolean))];
      if (!postIds.length) {
        return [];
      }

      const { data: posts } = await supabaseRequest<any[]>(
        async () => {
          const { data, error, status } = await supabase
            .from('posts')
            .select(`
              id,
              title,
              content,
              type,
              image_url,
              created_at,
              user_id,
              criteria
            `)
            .in('id', postIds);
          return { data, error, status };
        },
        { logTag: 'posts:listForBookmarks' }
      );

      const postsById = new Map<string, any>();
      (posts || []).forEach((post) => {
        postsById.set(post.id, post);
      });

      const userIds = [...new Set((posts || []).map((post) => post?.user_id).filter(Boolean))];

      // Fetch profiles for all users
      const { data: profiles } = await supabaseRequest<any[]>(
        async () => {
          const { data, error, status } = await supabase
            .from('legacy_public_profiles')
            .select('id, name, surname, username, avatar_url')
            .in('id', userIds);
          return { data, error, status };
        },
        { logTag: 'profiles:listForBookmarks' }
      );

      // Create a map of user profiles
      const profileMap = new Map();
      if (profiles) {
        profiles.forEach(profile => {
          profileMap.set(profile.id, profile);
        });
      }

      return bookmarks
        .map((bookmark) => ({
          ...bookmark,
          post: postsById.get(bookmark.post_id) || null,
        }))
        .filter(bookmark => bookmark.post)
        .map(bookmark => ({
          id: bookmark.post_id,
          type: 'post' as const,
          data: {
            ...(bookmark.post as any),
            criteria: {
              ...((bookmark.post as any)?.criteria || {}),
              company:
                (bookmark.post as any)?.criteria?.company ||
                (bookmark.post as any)?.company_name ||
                undefined,
              companyLogo:
                (bookmark.post as any)?.criteria?.companyLogo ||
                (bookmark.post as any)?.company_logo ||
                undefined,
              companyId:
                (bookmark.post as any)?.criteria?.companyId ||
                (bookmark.post as any)?.criteria?.company_id ||
                undefined,
            },
            profiles: profileMap.get((bookmark.post as any).user_id) || null
          },
          bookmarked_at: bookmark.created_at
        }));
    } catch (err) {
      console.error('Error fetching bookmarked posts:', err);
      return [];
    }
  }, [user]);

  // Fetch all applications (these are automatically "bookmarked" for the user)
  const fetchApplications = useCallback(async () => {
    if (!user) return [];

    try {
      const { data: applications } = await supabaseRequest<any[]>(
        async () => {
          const { data, error, status } = await supabase
            .from('applications')
            .select(`
              id,
              created_at,
              status,
              cover_letter,
              cover_letter_id,
              resume_id,
              resume_url,
              post_id,
              job_id,
              applicant_name_snapshot,
              applicant_phone_snapshot,
              job_title_snapshot,
              cv_document_id_snapshot,
              application_snapshot
            `)
            .eq('applicant_id', user.id)
            .order('created_at', { ascending: false });
          return { data, error, status };
        },
        { logTag: 'applications:listForBookmarks' }
      );

      const postIds = Array.from(
        new Set(
          (applications || [])
            .map((application) => application.post_id || application.job_id)
            .filter(Boolean)
        )
      );

      const { data: posts } = postIds.length
        ? await supabaseRequest<any[]>(
            async () => {
              const { data, error, status } = await supabase
                .from('posts')
                .select('id, title, content, type, criteria')
                .in('id', postIds);
              return { data, error, status };
            },
            { logTag: 'posts:listForApplicationBookmarks' }
          )
        : { data: [] as any[] };

      const postsById = new Map<string, any>();
      (posts || []).forEach((post) => {
        postsById.set(post.id, post);
      });

      return applications.map(application => ({
        id: application.id,
        type: 'application' as const,
        data: {
          ...application,
          post: postsById.get(application.post_id || application.job_id) || null,
        },
        bookmarked_at: application.created_at
      }));
    } catch (err) {
      console.error('Error fetching applications:', err);
      return [];
    }
  }, [user]);

  // Fetch all bookmarked items (posts + applications)
  const fetchBookmarkedItems = useCallback(async () => {
    if (!user) {
      setBookmarkedItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [bookmarkedPosts, applications] = await Promise.all([
        fetchBookmarkedPosts(),
        fetchApplications()
      ]);

      const allItems = [...bookmarkedPosts, ...applications];

      // Sort by bookmarked_at date (most recent first)
      allItems.sort((a, b) =>
        new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime()
      );

      setBookmarkedItems(allItems);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bookmarks');
      console.error('Error fetching bookmarked items:', err);
    } finally {
      setLoading(false);
    }
  }, [user, fetchBookmarkedPosts, fetchApplications]);

  // Refresh bookmarks
  const refreshBookmarks = useCallback(async () => {
    await fetchBookmarkedItems();
  }, [fetchBookmarkedItems]);

  // Remove bookmark (for posts only)
  const removeBookmark = useCallback(async (item: BookmarkedItem) => {
    if (item.type === 'post') {
      const result = await toggleBookmark(item.id);
      if (result.success) {
        // Remove from local state
        setBookmarkedItems(prev => prev.filter(bookmark =>
          !(bookmark.type === 'post' && bookmark.id === item.id)
        ));
      }
      return result;
    } else {
      // Applications can't be "unbookmarked" - they're automatically tracked
      return { success: false, error: 'Applications cannot be unbookmarked' };
    }
  }, [toggleBookmark]);

  // Initialize bookmarks when user changes
  useEffect(() => {
    fetchBookmarkedItems();
  }, [fetchBookmarkedItems]);

  return {
    bookmarkedItems,
    loading,
    error,
    toggleBookmark,
    removeBookmark,
    refreshBookmarks,
    initializePost,
    bookmarkStates
  };
}
