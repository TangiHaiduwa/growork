import { useState, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase";
import { supabaseRequest } from "@/utils/supabaseRequest";
import { PostWithProfile } from "../posts";
import { PostType } from "@/types/enums";
import { filterExpiredPublicPosts } from "@/utils/postVisibility";

export type SearchResult = PostWithProfile & { _type: "post" };

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeSearchIdRef = useRef(0);

  const search = useCallback(
    async (searchTerm: string, type?: PostType, industryFilter?: string) => {
      if (!searchTerm.trim()) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }

      const searchId = ++activeSearchIdRef.current;

      try {
        setLoading(true);
        setError(null);

        let postsQuery = supabase
          .from("posts")
          .select("*")
          .or(
            `title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,criteria->>company.ilike.%${searchTerm}%`
          )
          .order("created_at", { ascending: false })
          .limit(20);

        if (type) {
          postsQuery = postsQuery.eq("type", type);
        }
        if (industryFilter) {
          postsQuery = postsQuery.eq("industry", industryFilter);
        }

        const { data: postsData } = await supabaseRequest<any[]>(
          async () => {
            const { data, error, status } = await postsQuery;
            return { data, error, status };
          },
          { logTag: "search:posts" }
        );

        const userIds = Array.from(
          new Set((postsData || []).map((post) => post.user_id).filter(Boolean))
        );

        let profilesMap: Record<string, any> = {};
        if (userIds.length > 0) {
          const { data: profilesData } = await supabaseRequest<any[]>(
            async () => {
              const { data, error, status } = await supabase
                .from("legacy_public_profiles")
                .select("*")
                .in("id", userIds);
              return { data, error, status };
            },
            { logTag: "search:profiles" }
          );

          profilesMap = (profilesData || []).reduce(
            (map, profile) => {
              map[profile.id] = profile;
              return map;
            },
            {} as Record<string, any>
          );
        }

        if (searchId !== activeSearchIdRef.current) {
          return;
        }

        setResults(
          filterExpiredPublicPosts(postsData || []).map((post) => ({
            ...post,
            profiles: profilesMap[post.user_id] || null,
            likes: [],
            comments: [],
            _type: "post" as const,
          }))
        );
      } catch (err: any) {
        console.error("Error searching:", err);
        setError(err.message || "Search failed");
      } finally {
        if (searchId === activeSearchIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const clearResults = useCallback(() => {
    activeSearchIdRef.current += 1;
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clearResults,
  };
}
