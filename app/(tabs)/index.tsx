import React, { useMemo, useRef, useState, useCallback } from "react";
import {
  Animated,
  Alert,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import Header, { HEADER_HEIGHT } from "@/components/home/Header";
import ScreenContainer from "@/components/ScreenContainer";
import {
  useApplicationStatuses,
  useAuth,
  useHomeFeed,
  usePermissions,
  useThemeColor,
} from "@/hooks";
import { ThemedText } from "@/components/ThemedText";
import { useBottomSheetManager } from "@/components/content/BottomSheetManager";
import ContentCard from "@/components/content/ContentCard";
import { PostType } from "@/types/enums";
import { ContentCardSkeleton } from "@/components/ui/Skeleton";
import NewPostsIndicator from "@/components/ui/NewPostsIndicator";
import { useInteractions } from "@/hooks/posts/useInteractions";
import { INDUSTRIES } from "@/dataset/industries";
import { buildHomeFeedQuery, feedFilters } from "@/src/features/feed/services/homeFeedPlanner";
import type { FeedFilter, FeedItemType } from "@/src/features/feed/domain/feed";
import { BorderRadius, Colors, Spacing, Typography } from "@/constants/DesignSystem";
import { useRouter } from "expo-router";
import ActionPromptModal from "@/components/ui/ActionPromptModal";
import { useFlashToast } from "@/components/ui/Flash";

export default function Home() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { isBusinessUser } = usePermissions();
  const tintColor = useThemeColor({}, "tint");
  const accentContrast = useThemeColor({}, "accentContrast");
  const mutedTextColor = useThemeColor({}, "mutedText");
  const cardColor = useThemeColor({}, "backgroundSecondary");
  const pillColor = useThemeColor({}, "backgroundTertiary");
  const borderColor = useThemeColor({}, "border");

  const [selectedFilter, setSelectedFilter] = useState<FeedFilter>("all");
  const [selectedIndustry, setSelectedIndustry] = useState(-1);
  const [refreshing, setRefreshing] = useState(false);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [lastPostCount, setLastPostCount] = useState(0);
  const [showBusinessUpgradePrompt, setShowBusinessUpgradePrompt] =
    useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<any>(null);
  const lastScrollY = useRef(0);
  const isAnimating = useRef(false);

  const selectedIndustryLabel =
    selectedIndustry >= 0 ? INDUSTRIES[selectedIndustry]?.label ?? null : null;
  const feedQuery = useMemo(
    () =>
      buildHomeFeedQuery({
        filter: selectedFilter,
        industry: selectedIndustryLabel,
      }),
    [selectedFilter, selectedIndustryLabel]
  );
  const { posts: cardPosts, page, loading, error, refresh } = useHomeFeed({
    filter: feedQuery.filter,
    industry: feedQuery.industry,
  });
  const { initializePosts } = useInteractions();

  const selectedContentType = useMemo(
    () => Math.max(feedFilters.findIndex((item) => item.id === selectedFilter), 0),
    [selectedFilter]
  );

  const postIds = useMemo(
    () => cardPosts.map((p: any) => p.id as string).filter(Boolean),
    [cardPosts]
  );
  const postIdsKey = useMemo(() => postIds.join(","), [postIds]);
  React.useEffect(() => {
    if (postIds.length) initializePosts(postIds);
  }, [postIdsKey, initializePosts]);

  const { statuses: applicationStatuses, refresh: refreshApplicationStatuses } =
    useApplicationStatuses(postIds);

  const appliedPostIds = useMemo(() => {
    const set = new Set<string>();
    for (const application of applicationStatuses || []) {
      const id = (application as any).post_id || (application as any).job_id;
      if (id) set.add(id);
    }
    return set;
  }, [applicationStatuses]);

  const feedSummary = useMemo(() => {
    const items = page.items || [];
    const countByType = (type: FeedItemType) =>
      items.filter((item) => item.type === type).length;

    return {
      total: items.length,
      jobs: countByType("job"),
      news: items.filter((item) => item.type === "news" || item.type === "company_post").length,
      title:
        selectedFilter === "jobs"
          ? "Jobs feed"
          : selectedFilter === "news"
          ? "News feed"
          : "Home feed",
      subtitle:
        selectedFilter === "jobs"
          ? "Browse active opportunities from the companies you follow and discover new openings."
          : selectedFilter === "news"
          ? "Stay current with industry updates, company posts, and professional news."
          : "A familiar mixed feed of jobs, company activity, and professional content.",
    };
  }, [page.items, selectedFilter]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    if (y < 40) {
      lastScrollY.current = y;
      return;
    }
    if (diff > 10 && !isAnimating.current) {
      isAnimating.current = true;
      Animated.timing(headerAnim, {
        toValue: -HEADER_HEIGHT,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        isAnimating.current = false;
      });
    } else if (diff < -10 && !isAnimating.current) {
      isAnimating.current = true;
      setTimeout(() => {
        Animated.timing(headerAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          isAnimating.current = false;
        });
      }, 300);
    }
    lastScrollY.current = y;
  };

  const handlePostSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const checkForNewPosts = useCallback(() => {
    if (cardPosts.length > lastPostCount && lastPostCount > 0) {
      setHasNewPosts(true);
    }
    setLastPostCount(cardPosts.length);
  }, [cardPosts.length, lastPostCount]);

  React.useEffect(() => {
    checkForNewPosts();
  }, [cardPosts.length, checkForNewPosts]);

  const handleScrollToTop = useCallback(() => {
    setHasNewPosts(false);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  }, []);

  const { openCreatePostSheet, openJobApplicationSheet } =
    useBottomSheetManager({ onPostSuccess: handlePostSuccess });
  const toast = useFlashToast();

  function handleShowCreatePost() {
    if (!isBusinessUser) {
      setShowBusinessUpgradePrompt(true);
      return;
    }

    openCreatePostSheet();
  }

  const handleApplyToJob = useCallback(
    (post: any) => {
      if (post.variant === "job" && post.id) {
        const jobPost = {
          id: post.id,
          title: post.title,
          content: post.description,
          type: PostType.Job,
          user_id: post.user_id || "",
          created_at: post.createdAt || new Date().toISOString(),
          updated_at: null,
          image_url: post.mainImage || null,
          industry: post.industry || null,
          criteria: post.criteria || null,
          is_sponsored: false,
        };

        openJobApplicationSheet(jobPost, {
          onSuccess: () => {
            refreshApplicationStatuses();
          },
        });
      }
    },
    [openJobApplicationSheet, refreshApplicationStatuses]
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <View style={[styles.heroCard, { backgroundColor: cardColor, borderColor }]}>
        <ThemedText style={styles.heroTitle}>{feedSummary.title}</ThemedText>
        <ThemedText style={[styles.heroSubtitle, { color: mutedTextColor }]}>
          {feedSummary.subtitle}
        </ThemedText>
        <View style={styles.heroStats}>
          <SummaryPill label="All" value={feedSummary.total} backgroundColor={pillColor} borderColor={borderColor} labelColor={mutedTextColor} />
          <SummaryPill label="Jobs" value={feedSummary.jobs} backgroundColor={pillColor} borderColor={borderColor} labelColor={mutedTextColor} />
          <SummaryPill label="News" value={feedSummary.news} backgroundColor={pillColor} borderColor={borderColor} labelColor={mutedTextColor} />
          {selectedIndustryLabel ? (
            <SummaryPill label="Industry" value={selectedIndustryLabel} backgroundColor={pillColor} borderColor={borderColor} labelColor={mutedTextColor} />
          ) : null}
        </View>
      </View>
    </View>
  );

  if (loading && !cardPosts.length) {
    return (
      <ScreenContainer>
        <ActionPromptModal
          visible={showBusinessUpgradePrompt}
          title="Business setup required"
          message="Create your company first to publish jobs and company posts."
          cancelLabel="Not now"
          confirmLabel="Set up business"
          onCancel={() => setShowBusinessUpgradePrompt(false)}
          onConfirm={() => {
            setShowBusinessUpgradePrompt(false);
            const params = new URLSearchParams({
              upgradeToBusiness: "true",
            });

            const fullName = [profile?.name, profile?.surname]
              .map((value) => (value || "").trim())
              .filter(Boolean)
              .join(" ");

            if (fullName) {
              params.set("prefillName", fullName);
            }

            if (profile?.profession?.trim()) {
              params.set("prefillIndustry", profile.profession.trim());
            }

            if (profile?.location?.trim()) {
              params.set("prefillLocation", profile.location.trim());
            }

            toast.show({
              type: "info",
              title: "Business setup",
              message: "Finish your company profile to unlock publishing.",
            });
            router.push(`/profile/CompanyManagement?${params.toString()}`);
          }}
        />
        <Animated.View
          style={{
            transform: [{ translateY: headerAnim }],
            zIndex: 10,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          <Header
            selectedContentType={selectedContentType}
            onContentTypeChange={(index) =>
              setSelectedFilter(feedFilters[index]?.id ?? "all")
            }
            selectedIndustry={selectedIndustry}
            onIndustryChange={setSelectedIndustry}
            onAddPost={handleShowCreatePost}
          />
        </Animated.View>

        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={tintColor}
              colors={[tintColor]}
            />
          }
          contentContainerStyle={{ paddingTop: HEADER_HEIGHT + Spacing.md }}
        >
          {renderHeader()}
          {[1, 2, 3, 4, 5].map((index) => (
            <ContentCardSkeleton key={`skeleton-${index}`} />
          ))}
        </Animated.ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ActionPromptModal
        visible={showBusinessUpgradePrompt}
        title="Business setup required"
        message="Create your company first to publish jobs and company posts."
        cancelLabel="Not now"
        confirmLabel="Set up business"
        onCancel={() => setShowBusinessUpgradePrompt(false)}
        onConfirm={() => {
          setShowBusinessUpgradePrompt(false);
          const params = new URLSearchParams({
            upgradeToBusiness: "true",
          });

          const fullName = [profile?.name, profile?.surname]
            .map((value) => (value || "").trim())
            .filter(Boolean)
            .join(" ");

          if (fullName) {
            params.set("prefillName", fullName);
          }

          if (profile?.profession?.trim()) {
            params.set("prefillIndustry", profile.profession.trim());
          }

          if (profile?.location?.trim()) {
            params.set("prefillLocation", profile.location.trim());
          }

          toast.show({
            type: "info",
            title: "Business setup",
            message: "Finish your company profile to unlock publishing.",
          });
          router.push(`/profile/CompanyManagement?${params.toString()}`);
        }}
      />
      <Animated.View
        style={{
          transform: [{ translateY: headerAnim }],
          zIndex: 10,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
        }}
      >
        <Header
          selectedContentType={selectedContentType}
          onContentTypeChange={(index) =>
            setSelectedFilter(feedFilters[index]?.id ?? "all")
          }
          selectedIndustry={selectedIndustry}
          onIndustryChange={setSelectedIndustry}
          onAddPost={handleShowCreatePost}
        />
      </Animated.View>

      <NewPostsIndicator
        visible={hasNewPosts}
        onPress={handleScrollToTop}
        style={{ top: HEADER_HEIGHT + 20 }}
      />

      <Animated.FlatList
        ref={listRef}
        data={cardPosts}
        keyExtractor={(item, index) =>
          `${item.title}-${item.variant}-${index}-${item.id ?? "unknown"}`
        }
        renderItem={({ item }) => (
          <ContentCard
            {...item}
            hasApplied={item.variant === "job" && !!item.id && appliedPostIds.has(item.id)}
            isOwnedByCurrentUser={
              item.variant === "job" && !!user?.id && item.user_id === user.id
            }
            ownerBadgeLabel="Your listing"
            ownerActionLabel="Manage"
            onPressApply={() => handleApplyToJob(item)}
          />
        )}
        removeClippedSubviews={false}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={3}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tintColor}
            colors={[tintColor]}
          />
        }
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT + Spacing.md, paddingBottom: Spacing.xl }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={36} color={mutedTextColor} />
            <ThemedText style={styles.emptyTitle}>Nothing to show yet</ThemedText>
            <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}> 
              {error
                ? "We couldn't load your feed right now. Pull to refresh or try again in a moment."
                : selectedIndustryLabel
                ? `There is no ${selectedFilter === "all" ? "content" : selectedFilter} in ${selectedIndustryLabel} yet.`
                : `There is no ${selectedFilter === "all" ? "content" : selectedFilter} to show right now.`}
            </ThemedText>
            {error ? (
              <Pressable style={[styles.retryButton, { backgroundColor: tintColor }]} onPress={() => refresh()}>
                <ThemedText style={[styles.retryButtonText, { color: accentContrast }]}>Retry</ThemedText>
              </Pressable>
            ) : null}
          </View>
        }
        ListFooterComponent={
          error && cardPosts.length ? (
            <View style={styles.footerError}>
              <ThemedText style={styles.footerErrorText}>
                We hit a snag loading more content.
              </ThemedText>
              <Pressable style={[styles.retryButton, { backgroundColor: tintColor }]} onPress={() => refresh()}>
                <ThemedText style={[styles.retryButtonText, { color: accentContrast }]}>Retry</ThemedText>
              </Pressable>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

function SummaryPill({
  label,
  value,
  backgroundColor,
  borderColor,
  labelColor,
}: {
  label: string;
  value: number | string;
  backgroundColor: string;
  borderColor: string;
  labelColor: string;
}) {
  return (
    <View style={[styles.summaryPill, { backgroundColor, borderColor }]}> 
      <ThemedText style={[styles.summaryPillLabel, { color: labelColor }]}>{label}</ThemedText>
      <ThemedText style={styles.summaryPillValue}>{String(value)}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  heroCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
  },
  heroSubtitle: {
    fontSize: Typography.sm,
    lineHeight: 20,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  summaryPill: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  summaryPillLabel: {
    fontSize: Typography.sm,
  },
  summaryPillValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing["4xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    textAlign: "center",
  },
  emptyText: {
    fontSize: Typography.base,
    lineHeight: 22,
    textAlign: "center",
  },
  retryButton: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  retryButtonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  footerError: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  footerErrorText: {
    color: Colors.error,
    fontSize: Typography.sm,
    textAlign: "center",
  },
});
