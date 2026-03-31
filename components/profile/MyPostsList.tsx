import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { MyPostCard } from "@/components/content/MyPostCard";
import { useAuth, useMyPosts, useThemeColor } from "@/hooks";
import { supabase } from "@/utils/supabase";
import { deletePost } from "@/hooks/posts/usePostOperations";
import { useBottomSheetManager } from "@/components/content/BottomSheetManager";
import { PostWithProfile } from "@/hooks/posts";
import { PostType } from "@/types";
import { isPostExpired } from "@/utils/postVisibility";

interface MyPost extends PostWithProfile {
  is_active: boolean;
  applications_count: number;
  is_expired?: boolean;
}

export default function MyPostsList() {
  const { user } = useAuth();

  const { openCreatePostSheet } = useBottomSheetManager({
    onPostSuccess: () => {
      if (user) {
        refreshPosts();
      }
    },
  });

  const {
    posts,
    loading,
    error,
    refresh: refreshPosts,
  } = useMyPosts(user?.id || "");

  const textColor = useThemeColor({}, "text");
  const mutedTextColor = useThemeColor({}, "mutedText");
  const tintColor = useThemeColor({}, "tint");

  const [applicationCounts, setApplicationCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    const loadApplicationCounts = async () => {
      const jobPostIds = posts
        .filter((post) => post.type === "job")
        .map((post) => post.id);

      if (jobPostIds.length === 0) {
        if (!cancelled) {
          setApplicationCounts({});
        }
        return;
      }

      const { data, error } = await supabase
        .from("applications")
        .select("post_id,job_id")
        .or(`post_id.in.(${jobPostIds.join(",")}),job_id.in.(${jobPostIds.join(",")})`);

      if (cancelled) {
        return;
      }

      if (error) {
        setApplicationCounts({});
        return;
      }

      const counts = (data || []).reduce((acc: Record<string, number>, application: any) => {
        const key = application.post_id || application.job_id;
        if (key) {
          acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
      }, {});

      setApplicationCounts(counts);
    };

    loadApplicationCounts();

    return () => {
      cancelled = true;
    };
  }, [posts]);

  const enrichedPosts = useMemo(() => {
    return posts.map((item) => {
      const isExpired = isPostExpired(item);

      const isActiveFlag = item.criteria?.is_active;
      const isActive =
        typeof isActiveFlag === "boolean" ? isActiveFlag : !isExpired;

      return {
        ...item,
        is_active: isActive,
        applications_count: applicationCounts[item.id] || 0,
        is_expired: isExpired,
      } satisfies MyPost;
    });
  }, [applicationCounts, posts]);

  const handlePostStatusUpdate = async (
    postId: string,
    status: "active" | "inactive"
  ) => {
    try {
      if (!user?.id) {
        throw new Error("Not authenticated");
      }

      const targetPost = posts.find((post) => post.id === postId);
      if (!targetPost) {
        throw new Error("Post not found");
      }

      const nextCriteria = {
        ...(targetPost.criteria || {}),
        is_active: status === "active",
      };

      const { error: postError } = await supabase
        .from("posts")
        .update({
          criteria: nextCriteria,
        })
        .eq("id", postId)
        .eq("user_id", user?.id);

      if (postError) {
        throw postError;
      }

      if (targetPost.type === PostType.Job && targetPost.id) {
        const linkedJobId = (targetPost as any).job_id || targetPost.id;
        const { error: jobError } = await supabase
          .from("jobs")
          .update({
            is_closed: status !== "active",
          })
          .eq("id", linkedJobId)
          .eq("owner_id", user.id);

        if (jobError) {
          throw jobError;
        }
      }

      await refreshPosts();
      Alert.alert(
        "Post Updated",
        status === "active"
          ? "The post is active again."
          : "The post has been paused."
      );
    } catch (error) {
      Alert.alert(
        "Error",
        "We couldn't update the post status right now. Please try again."
      );
    }
  };

  const handlePostDelete = async (postId: string) => {
    try {
      const { error } = await deletePost(postId);
      if (error) {
        Alert.alert("Error", "Failed to delete post. Please try again.");
      } else {
        // Refresh the posts list
        refreshPosts();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to delete post. Please try again.");
    }
  };

  const handlePostEdit = (post: MyPost) => {
    setTimeout(() => {
      openCreatePostSheet(post);
    }, 200);
  };

  const renderPostItem = ({ item }: { item: MyPost }) => {
    return (
      <MyPostCard
        post={item}
        onStatusUpdate={handlePostStatusUpdate}
        onDelete={handlePostDelete}
        onEdit={handlePostEdit}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText style={[styles.loadingText, { color: mutedTextColor }]}>
          Loading your posts...
        </ThemedText>
      </View>
    );
  }

  // If there are no posts, show empty state
  if (posts.length === 0)
    return (
      <View style={styles.centerContainer}>
        <Feather name="file-text" size={48} color={mutedTextColor} />
        <ThemedText
          style={[styles.emptyTitle, { color: textColor, marginTop: 16 }]}
        >
          No Posts Yet
        </ThemedText>
        <ThemedText
          style={[
            styles.emptyDescription,
            { color: mutedTextColor, marginTop: 8 },
          ]}
        >
          You haven&apos;t created any posts yet.
        </ThemedText>
        <Pressable
          style={[
            styles.createPostButton,
            { backgroundColor: tintColor, marginTop: 16 },
          ]}
          onPress={() => openCreatePostSheet()}
        >
          <ThemedText style={styles.createPostButtonText}>
            Create Your First Post
          </ThemedText>
        </Pressable>
      </View>
    );

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="alert-circle" size={48} color="#FF3B30" />
        <ThemedText style={[styles.errorText, { color: textColor }]}>
          Error loading posts
        </ThemedText>
        <ThemedText style={[styles.errorSubtext, { color: mutedTextColor }]}>
          {error}
        </ThemedText>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: tintColor }]}
          onPress={refreshPosts}
        >
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.listContent}>
        {enrichedPosts.map((item) => (
          <View key={item.id}>{renderPostItem({ item })}</View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    width: "100%",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  createPostButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  createPostButtonText: {
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
