import React, { useState, useMemo, useCallback } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import ScreenContainer from "@/components/ScreenContainer";
import CategorySelector from "@/components/ui/CategorySelector";
import BookmarkedContentList from "@/components/content/BookmarkedContentList";
import { PostSkeleton } from "@/components/ui/SkeletonLoader";
import { ThemedText } from "@/components/ThemedText";
import { useAuth, useBookmarks, useThemeColor } from "@/hooks";
import { useInteractions } from "@/hooks/posts/useInteractions";
import { BorderRadius, Colors, Spacing, Typography } from "@/constants/DesignSystem";

const categoryOptions = ["All", "Jobs", "News", "Applications"];

export default function Bookmarks() {
  const tintColor = useThemeColor({}, "tint");
  const accentContrast = useThemeColor({}, "accentContrast");
  const mutedTextColor = useThemeColor({}, "mutedText");
  const cardColor = useThemeColor({}, "backgroundSecondary");
  const pillColor = useThemeColor({}, "backgroundTertiary");
  const borderColor = useThemeColor({}, "border");

  const [refreshing, setRefreshing] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState(0);
  const { user, loading: authLoading } = useAuth();
  const { bookmarkedItems, loading, error, refreshBookmarks } = useBookmarks();
  const { initializePosts } = useInteractions();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      // If a bookmark is toggled elsewhere, this tab may remain mounted.
      // Refresh on focus so the list stays accurate.
      refreshBookmarks();
    }, [refreshBookmarks])
  );

  const filteredItems = useMemo(() => {
    return bookmarkedItems.filter((item) => {
      if (selectedContentType === 1) {
        return item.type === "post" && item.data?.type === "job";
      }
      if (selectedContentType === 2) {
        return item.type === "post" && item.data?.type === "news";
      }
      if (selectedContentType === 3) {
        return item.type === "application";
      }
      return true;
    });
  }, [bookmarkedItems, selectedContentType]);

  const counts = useMemo(
    () => ({
      all: bookmarkedItems.length,
      jobs: bookmarkedItems.filter(
        (item) => item.type === "post" && item.data?.type === "job"
      ).length,
      news: bookmarkedItems.filter(
        (item) => item.type === "post" && item.data?.type === "news"
      ).length,
      applications: bookmarkedItems.filter((item) => item.type === "application")
        .length,
    }),
    [bookmarkedItems]
  );

  const allPostIds = useMemo(
    () =>
      bookmarkedItems
        .filter((item) => item.type === "post")
        .map((item) => item.id)
        .filter(Boolean),
    [bookmarkedItems]
  );

  React.useEffect(() => {
    if (allPostIds.length) {
      initializePosts(allPostIds);
    }
  }, [allPostIds.join(","), initializePosts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBookmarks();
    } finally {
      setRefreshing(false);
    }
  }, [refreshBookmarks]);

  const handleItemPress = useCallback(
    (item: any) => {
      if (item.type === "post") {
        router.push(`/post/${item.id}`);
        return;
      }
      router.push(`/application/${item.id}`);
    },
    [router]
  );

  const summaryTitle = useMemo(() => {
    switch (selectedContentType) {
      case 1:
        return "Saved jobs";
      case 2:
        return "Saved news";
      case 3:
        return "Tracked applications";
      default:
        return "Everything you saved";
    }
  }, [selectedContentType]);

  const summarySubtitle = useMemo(() => {
    switch (selectedContentType) {
      case 1:
        return "Keep opportunities close so you can come back when you're ready to apply.";
      case 2:
        return "Hold onto news and company updates worth revisiting.";
      case 3:
        return "Track the applications you've already put into motion.";
      default:
        return "Your saved jobs, useful updates, and tracked applications live together here.";
    }
  }, [selectedContentType]);

  return (
    <ScreenContainer>
      {authLoading ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: pillColor }]}>
            <Feather name="bookmark" size={32} color={mutedTextColor} />
          </View>
        </View>
      ) : !user ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: pillColor }]}>
            <Feather name="bookmark" size={32} color={mutedTextColor} />
          </View>
          <ThemedText style={styles.emptyTitle}>Sign in to save content</ThemedText>
          <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>
            Your saved jobs, news, and tracked applications will appear here after you sign in.
          </ThemedText>
          <View style={styles.emptyActions}>
            <Pressable style={[styles.retryButton, { backgroundColor: tintColor }]} onPress={() => router.push("/auth/login")}>
              <ThemedText style={[styles.retryButtonText, { color: accentContrast }]}>Go to Login</ThemedText>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { backgroundColor: pillColor, borderColor }]} onPress={() => router.push("/(tabs)/search")}>
              <ThemedText style={[styles.secondaryButtonText, { color: tintColor }]}>Browse content</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={tintColor}
              colors={[tintColor]}
            />
          }
        >
          <View style={styles.listHeader}>
            <View style={[styles.heroCard, { backgroundColor: cardColor, borderColor }]}>
              <ThemedText style={styles.heroTitle}>{summaryTitle}</ThemedText>
              <ThemedText style={[styles.heroSubtitle, { color: mutedTextColor }]}>{summarySubtitle}</ThemedText>
              <View style={styles.heroStats}>
                <SummaryPill label="All" value={counts.all} backgroundColor={pillColor} borderColor={borderColor} labelColor={mutedTextColor} />
                <SummaryPill label="Jobs" value={counts.jobs} backgroundColor={pillColor} borderColor={borderColor} labelColor={mutedTextColor} />
                <SummaryPill label="News" value={counts.news} backgroundColor={pillColor} borderColor={borderColor} labelColor={mutedTextColor} />
                <SummaryPill label="Applications" value={counts.applications} backgroundColor={pillColor} borderColor={borderColor} labelColor={mutedTextColor} />
              </View>
            </View>
          </View>

          <View style={styles.filtersSection}>
            <CategorySelector
              selectedIndex={selectedContentType}
              onChange={setSelectedContentType}
              options={categoryOptions}
            />
          </View>

          <View style={styles.resultsSection}>
            {loading ? (
              <View style={styles.loadingContainer}>
                {[1, 2, 3].map((index) => (
                  <PostSkeleton key={`bookmark-skeleton-${index}`} />
                ))}
              </View>
            ) : filteredItems.length > 0 ? (
              <>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>
                    {filteredItems.length} saved item
                    {filteredItems.length === 1 ? "" : "s"}
                  </ThemedText>
                  <ThemedText style={[styles.sectionSubtitle, { color: mutedTextColor }]}>
                    Revisit important content without losing the familiar discovery flow.
                  </ThemedText>
                </View>
                <BookmarkedContentList
                  items={filteredItems}
                  subtitle="Saved content and tracked applications"
                  onItemPress={handleItemPress}
                  emptyText={
                    bookmarkedItems.length === 0
                      ? "No bookmarks yet"
                      : "No saved items match this filter"
                  }
                />
              </>
            ) : (
              <EmptyBookmarksState
                hasAnyBookmarks={bookmarkedItems.length > 0}
                selectedContentType={selectedContentType}
              />
            )}

            {error ? (
              <View style={styles.footerError}>
                <ThemedText style={styles.footerErrorText}>
                  We hit a snag loading your saved items.
                </ThemedText>
                <Pressable style={[styles.retryButton, { backgroundColor: tintColor }]} onPress={handleRefresh}>
                  <ThemedText style={[styles.retryButtonText, { color: accentContrast }]}>Retry</ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
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

function EmptyBookmarksState({
  hasAnyBookmarks,
  selectedContentType,
}: {
  hasAnyBookmarks: boolean;
  selectedContentType: number;
}) {
  const mutedTextColor = useThemeColor({}, "mutedText");
  const iconCircleColor = useThemeColor({}, "backgroundTertiary");

  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.iconCircle, { backgroundColor: iconCircleColor }]}> 
        <Feather name="bookmark" size={32} color={mutedTextColor} />
      </View>
      <ThemedText style={styles.emptyTitle}>
        {hasAnyBookmarks ? "Nothing in this view yet" : "No bookmarks yet"}
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}> 
        {buildEmptyMessage(hasAnyBookmarks, selectedContentType)}
      </ThemedText>
    </View>
  );
}

function buildEmptyMessage(hasAnyBookmarks: boolean, selectedContentType: number) {
  if (!hasAnyBookmarks) {
    return "Save jobs, news, or tracked applications and they'll show up here in one place.";
  }

  switch (selectedContentType) {
    case 1:
      return "You haven't saved any jobs in this view yet. Try switching back to All or save something from Home.";
    case 2:
      return "You haven't saved any news yet. Save updates from Home or Search to revisit them here.";
    case 3:
      return "No tracked applications match this view yet. Once you apply, they'll appear here too.";
    default:
      return "There's nothing in this filtered view right now. Try another tab or save something new.";
  }
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: Spacing["4xl"],
  },
  listHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
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
  filtersSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  resultsSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
  },
  sectionSubtitle: {
    fontSize: Typography.sm,
    lineHeight: 20,
  },
  loadingContainer: {
    gap: Spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing["4xl"],
    gap: Spacing.md,
  },
  iconCircle: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.full,
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
  emptyActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
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
  secondaryButton: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  secondaryButtonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
});
