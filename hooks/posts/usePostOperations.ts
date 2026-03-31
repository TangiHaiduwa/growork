import { useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { supabaseRequest } from '@/utils/supabaseRequest';
import { PostType } from '@/types';
import { ContentCardProps } from '@/components/content/ContentCard';
import { filterExpiredPublicPosts } from '@/utils/postVisibility';

export type ExtendedContentCardProps = ContentCardProps & {
  industry?: string;
  id?: string;
  user_id?: string;
};

export interface DbPost {
  id: string;
  user_id: string;
  type: PostType;
  title: string | null;
  content: string | null;
  image_url: string | null;
  company_name?: string | null;
  company_logo?: string | null;
  created_at: string;
  updated_at: string | null;
  is_sponsored: boolean;
  industry?: string | null;
  criteria?: any;
  likes?: { id: string; user_id: string; post_id: string }[];
  comments?: { id: string; user_id: string; post_id: string; content: string }[];
}

type PostMutationInput = {
  user_id: string;
  type: PostType;
  title: string;
  content: string;
  image_url?: string | null;
  industry?: string | null;
  is_sponsored?: boolean;
  criteria?: any;
};

async function createPostRecord(postData: PostMutationInput) {
  const { data } = await supabaseRequest<any>(
    async () => {
      const { data, error, status } = await supabase
        .from('posts')
        .insert([
          {
            user_id: postData.user_id,
            type: postData.type,
            title: postData.title,
            content: postData.content,
            image_url: postData.image_url || null,
            industry: postData.industry || null,
            is_sponsored: postData.is_sponsored || false,
            criteria: postData.criteria || null,
          },
        ])
        .select('*')
        .single();
      return { data, error, status };
    },
    { logTag: 'posts:create' }
  );

  return data;
}

async function deletePostRecord(postId: string) {
  const { data } = await supabaseRequest<any>(
    async () => {
      const { data, error, status } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .select('*')
        .single();
      return { data, error, status };
    },
    { logTag: 'posts:delete' }
  );

  return data;
}

async function updatePostRecord(postId: string, postData: PostMutationInput) {
  const { data } = await supabaseRequest<any>(
    async () => {
      const { data, error, status } = await supabase
        .from("posts")
        .update({
          type: postData.type,
          title: postData.title,
          content: postData.content,
          image_url: postData.image_url || null,
          industry: postData.industry || null,
          is_sponsored: postData.is_sponsored || false,
          criteria: postData.criteria || null,
        })
        .eq("id", postId)
        .eq("user_id", postData.user_id)
        .select("*")
        .single();
      return { data, error, status };
    },
    { logTag: "posts:update" }
  );

  return data;
}

export function usePostOperations() {
  const buildPostCard = useCallback(
    (
      post: DbPost,
      companyData?: {
        id: string;
        name: string;
        logo_url?: string | null;
      } | null,
      profileData?: {
        avatar_url: string | null;
        name: string;
        surname: string;
        username?: string | null;
      } | null
    ): ExtendedContentCardProps => {
      const postProfile = profileData || {
        avatar_url: null,
        name: "Anonymous",
        surname: "",
      };

      const criteriaData = post.criteria || {};
      const resolvedCompanyName =
        criteriaData.company || post.company_name || companyData?.name || undefined;
      const resolvedCompanyId =
        criteriaData.companyId ||
        criteriaData.company_id ||
        companyData?.id ||
        undefined;
      const resolvedCompanyLogo =
        criteriaData.companyLogo || post.company_logo || companyData?.logo_url || undefined;
      const criteria = {
        companyId: resolvedCompanyId,
        company_id: resolvedCompanyId,
        company: resolvedCompanyName,
        companyLogo: resolvedCompanyLogo,
        location: criteriaData.location || undefined,
        salary: criteriaData.salary || undefined,
        jobType: criteriaData.jobType || undefined,
        deadline: criteriaData.deadline || undefined,
        source: criteriaData.source || undefined,
        publication_date: criteriaData.publication_date || undefined,
      };

      const fullName =
        `${postProfile.name ?? ""}${postProfile.surname ? ` ${postProfile.surname}` : ""}`.trim() ||
        undefined;

      return {
        id: post.id,
        title: post.title || "",
        description: post.content || "",
        mainImage: post.image_url || undefined,
        createdAt: post.created_at,
        variant: post.type === PostType.Job ? "job" : "news",
        user_id: post.user_id,
        criteria,
        industry: post.industry || undefined,
        authorName: fullName,
        authorAvatarUrl: postProfile.avatar_url || undefined,
      };
    },
    []
  );

  const convertDbPostToContentCard = useCallback(
    async (post: DbPost): Promise<ExtendedContentCardProps> => {
      let postProfile: {
        avatar_url: string | null;
        name: string;
        surname: string;
        username?: string | null;
      } = {
        avatar_url: null,
        name: 'Anonymous',
        surname: '',
      };

      try {
        const { data: profileData } = await supabaseRequest<any>(
          async () => {
            const { data, error, status } = await supabase
              .from('legacy_public_profiles')
              .select('id, avatar_url, username, name, surname')
              .eq('id', post.user_id)
              .maybeSingle();
            return { data, error, status };
          },
          { logTag: 'profiles:getForPost' }
        );

        if (profileData) {
          postProfile = profileData;
        }
      } catch (error) {
        console.warn('Error fetching profile data for post:', post.id, error);
      }

      let companyData: {
        id: string;
        name: string;
        logo_url?: string | null;
      } | null = null;
      const companyId = post.criteria?.companyId || post.criteria?.company_id;

      if (companyId) {
        try {
          const { data } = await supabaseRequest<any>(
            async () => {
              const { data, error, status } = await supabase
                .from("companies")
                .select("id, name, logo_url")
                .eq("id", companyId)
                .maybeSingle();
              return { data, error, status };
            },
            { logTag: "companies:getForPost" }
          );

          if (data) {
            companyData = data;
          }
        } catch (error) {
          console.warn("Error fetching company data for post:", post.id, error);
        }
      }

      return buildPostCard(post, companyData, postProfile);
    },
    [buildPostCard]
  );

  const convertDbPostsToContentCards = useCallback(
    async (posts: DbPost[]): Promise<ExtendedContentCardProps[]> => {
      if (!posts.length) {
        return [];
      }

      const userIds = Array.from(new Set(posts.map((post) => post.user_id).filter(Boolean)));
      const companyIds = Array.from(
        new Set(
          posts
            .map((post) => post.criteria?.companyId || post.criteria?.company_id)
            .filter(Boolean)
        )
      );
      let profilesById: Record<string, any> = {};
      let companiesById: Record<string, any> = {};

      if (userIds.length) {
        try {
          const { data: profilesData } = await supabaseRequest<any[]>(
            async () => {
              const { data, error, status } = await supabase
                .from("legacy_public_profiles")
                .select("id, avatar_url, username, name, surname")
                .in("id", userIds);
              return { data, error, status };
            },
            { logTag: "profiles:listForPosts" }
          );

          profilesById = (profilesData || []).reduce((acc: Record<string, any>, profile: any) => {
            if (profile?.id) {
              acc[profile.id] = profile;
            }
            return acc;
          }, {});
        } catch (error) {
          console.warn("Error batch fetching profile data for posts:", error);
        }
      }

      if (companyIds.length) {
        try {
          const { data: companiesData } = await supabaseRequest<any[]>(
            async () => {
              const { data, error, status } = await supabase
                .from("companies")
                .select("id, name, logo_url")
                .in("id", companyIds);
              return { data, error, status };
            },
            { logTag: "companies:listForPosts" }
          );

          companiesById = (companiesData || []).reduce(
            (acc: Record<string, any>, company: any) => {
              if (company?.id) {
                acc[company.id] = company;
              }
              return acc;
            },
            {}
          );
        } catch (error) {
          console.warn("Error batch fetching company data for posts:", error);
        }
      }

      return posts.map((post) =>
        buildPostCard(
          post,
          companiesById[post.criteria?.companyId || post.criteria?.company_id] || null,
          profilesById[post.user_id] || null
        )
      );
    },
    [buildPostCard]
  );

  const fetchPostsWithData = useCallback(
    async (filters?: {
      type?: PostType;
      industry?: string;
      userId?: string;
      limit?: number;
    }) => {
      try {
        let query = supabase
          .from('posts')
          .select(`
            *,
            likes(id, user_id),
            comments(id, user_id, content, created_at)
          `)
          .order('created_at', { ascending: false });

        if (filters?.type) {
          query = query.eq('type', filters.type);
        }

        if (filters?.industry) {
          query = query.eq('industry', filters.industry);
        }

        if (filters?.userId) {
          query = query.eq('user_id', filters.userId);
        }

        if (filters?.limit) {
          query = query.limit(filters.limit);
        }

        const { data: postsData } = await supabaseRequest<any[]>(
          async () => {
            const { data, error, status } = await query;
            return { data, error, status };
          },
          { logTag: 'posts:listWithRelations' }
        );

        const posts = postsData || [];
        return filters?.userId ? posts : filterExpiredPublicPosts(posts);
      } catch (error) {
        console.error('Error fetching posts with data:', error);
        throw error;
      }
    },
    []
  );

  const addPost = useCallback(async (postData: PostMutationInput) => {
    try {
      const data = await createPostRecord(postData);
      return { data, error: null };
    } catch (error) {
      console.error('Error in addPost:', error);
      return { data: null, error };
    }
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    try {
      const data = await deletePostRecord(postId);
      return { data, error: null };
    } catch (error) {
      console.error('Error in deletePost:', error);
      return { data: null, error };
    }
  }, []);

  const updatePost = useCallback(async (postId: string, postData: PostMutationInput) => {
    try {
      const data = await updatePostRecord(postId, postData);
      return { data, error: null };
    } catch (error) {
      console.error("Error in updatePost:", error);
      return { data: null, error };
    }
  }, []);

  return {
    convertDbPostToContentCard,
    convertDbPostsToContentCards,
    fetchPostsWithData,
    addPost,
    updatePost,
    deletePost,
  };
}

export const addPost = async (postData: PostMutationInput) => {
  try {
    const data = await createPostRecord(postData);
    return { data, error: null };
  } catch (error) {
    console.error('Error in addPost:', error);
    return { data: null, error };
  }
};

export const deletePost = async (postId: string) => {
  try {
    const data = await deletePostRecord(postId);
    return { data, error: null };
  } catch (error) {
    console.error('Error in deletePost:', error);
    return { data: null, error };
  }
};

export const updatePost = async (postId: string, postData: PostMutationInput) => {
  try {
    const data = await updatePostRecord(postId, postData);
    return { data, error: null };
  } catch (error) {
    console.error("Error in updatePost:", error);
    return { data: null, error };
  }
};
