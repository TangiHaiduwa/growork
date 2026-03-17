import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import ScreenContainer from "@/components/ScreenContainer";
import { ThemedText } from "@/components/ThemedText";
import CategorySelector from "@/components/ui/CategorySelector";
import SelectionPromptModal from "@/components/ui/SelectionPromptModal";
import ThemedButton from "@/components/ui/ThemedButton";
import { ApplicationSkeleton } from "@/components/ui/SkeletonLoader";
import { ApplicationCard } from "@/components/content/ApplicationCard";
import {
  useAuth,
  useMyPostApplications,
  useMyPosts,
  usePermissions,
  useThemeColor,
} from "@/hooks";
import { useApplications } from "@/hooks/applications";
import { ApplicationStatus } from "@/types/enums";
import {
  BorderRadius,
  Spacing,
  Typography,
} from "@/constants/DesignSystem";
import ActionPromptModal from "@/components/ui/ActionPromptModal";
import { useFlashToast } from "@/components/ui/Flash";

const MY_APPLICATIONS_LABEL = "My Applications";
const INCOMING_LABEL = "Incoming";
const STATUS_FILTERS = ["All", "Pending", "Reviewed", "Accepted", "Rejected"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

const toStatusFilter = (filter: StatusFilter): ApplicationStatus | null => {
  switch (filter) {
    case "Pending":
      return ApplicationStatus.Pending;
    case "Reviewed":
      return ApplicationStatus.Reviewed;
    case "Accepted":
      return ApplicationStatus.Accepted;
    case "Rejected":
      return ApplicationStatus.Rejected;
    default:
      return null;
  }
};

export default function ApplicationsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isBusinessUser } = usePermissions();
  const {
    applications: myApplications,
    loading: myApplicationsLoading,
    error: myApplicationsError,
    fetchApplications,
  } = useApplications(user?.id);
  const {
    applications: incomingApplications,
    loading: incomingLoading,
    error: incomingError,
    fetchApplicationsForMyPosts,
    updateApplicationStatus,
  } = useMyPostApplications();
  const { posts: myPosts } = useMyPosts(user?.id || "");

  const [refreshing, setRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [selectedIncomingPostId, setSelectedIncomingPostId] = useState<string | null>(null);
  const [showIncomingFilterModal, setShowIncomingFilterModal] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
    applicationId: string;
    newStatus: ApplicationStatus;
  } | null>(null);
  const toast = useFlashToast();

  const backgroundColor = useThemeColor({}, "background");
  const mutedTextColor = useThemeColor({}, "mutedText");
  const tintColor = useThemeColor({}, "tint");
  const borderColor = useThemeColor({}, "border");
  const cardColor = useThemeColor({}, "backgroundSecondary");

  const lastUserId = useRef<string | null>(null);

  const primaryTabs = isBusinessUser
    ? [MY_APPLICATIONS_LABEL, INCOMING_LABEL]
    : [MY_APPLICATIONS_LABEL];

  useEffect(() => {
    if (selectedIndex >= primaryTabs.length) {
      setSelectedIndex(0);
    }
  }, [primaryTabs.length, selectedIndex]);

  useEffect(() => {
    if (user?.id && user.id !== lastUserId.current) {
      lastUserId.current = user.id;
      fetchApplications();
    }
  }, [user?.id, fetchApplications]);

  // Ensure employer Incoming applications are always fetched once we know
  // both the user id and that this user has business capabilities.
  useEffect(() => {
    if (user?.id && isBusinessUser) {
      fetchApplicationsForMyPosts(user.id);
    }
  }, [user?.id, isBusinessUser, fetchApplicationsForMyPosts]);

  // Keep data in sync whenever this screen regains focus (e.g. after
  // accepting/rejecting from the application details screen).
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;

      fetchApplications();
      if (isBusinessUser) {
        fetchApplicationsForMyPosts(user.id);
      }
    }, [user?.id, isBusinessUser, fetchApplications, fetchApplicationsForMyPosts])
  );

  const selectedTab = primaryTabs[selectedIndex];
  const activeStatusFilter = STATUS_FILTERS[statusIndex];
  const statusValue = toStatusFilter(activeStatusFilter);

  const normalizedMyApplications = useMemo(
    () =>
      myApplications.map((application: any) => ({
        ...application,
        profiles: application.profiles ?? null,
        posts: application.posts ?? null,
      })),
    [myApplications]
  );

  const filteredMyApplications = useMemo(() => {
    if (!statusValue) {
      return normalizedMyApplications;
    }
    return normalizedMyApplications.filter((application: any) => application.status === statusValue);
  }, [normalizedMyApplications, statusValue]);

  const filteredIncomingApplications = useMemo(() => {
    const byListing = selectedIncomingPostId
      ? incomingApplications.filter(
          (application: any) =>
            application.post_id === selectedIncomingPostId
        )
      : incomingApplications;

    if (!statusValue) {
      return byListing;
    }
    return byListing.filter((application: any) => application.status === statusValue);
  }, [incomingApplications, selectedIncomingPostId, statusValue]);

  const myJobPosts = useMemo(
    () => myPosts.filter((post: any) => post.type === "job"),
    [myPosts]
  );

  const selectedManagedPost = useMemo(
    () =>
      selectedIncomingPostId
        ? myJobPosts.find((post: any) => post.id === selectedIncomingPostId) ?? null
        : null,
    [myJobPosts, selectedIncomingPostId]
  );

  const applicationSummary = useMemo(() => {
    const source = selectedTab === INCOMING_LABEL ? filteredIncomingApplications : filteredMyApplications;
    return {
      total: source.length,
      pending: source.filter((item: any) => item.status === ApplicationStatus.Pending).length,
      reviewed: source.filter((item: any) => item.status === ApplicationStatus.Reviewed).length,
      accepted: source.filter((item: any) => item.status === ApplicationStatus.Accepted).length,
    };
  }, [filteredIncomingApplications, filteredMyApplications, selectedTab]);

  const isLoading =
    selectedTab === INCOMING_LABEL ? incomingLoading && !refreshing : myApplicationsLoading && !refreshing;
  const activeError = selectedTab === INCOMING_LABEL ? incomingError : myApplicationsError;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchApplications();
      if (user?.id && isBusinessUser) {
        await fetchApplicationsForMyPosts(user.id);
      }
    } catch (_error) {
      toast.show({
        type: "danger",
        title: "Refresh unavailable",
        message:
          "We could not refresh this workspace right now. Please try again.",
      });
    } finally {
      setRefreshing(false);
    }
  }, [fetchApplications, fetchApplicationsForMyPosts, isBusinessUser, toast, user?.id]);

  const handleApplicationStatusUpdate = useCallback(
    async (applicationId: string, newStatus: ApplicationStatus) => {
      setPendingStatusUpdate({ applicationId, newStatus });
    },
    []
  );

  const renderApplicationItem = ({ item }: { item: any }) => (
    <ApplicationCard
      application={item}
      onStatusUpdate={selectedTab === INCOMING_LABEL ? handleApplicationStatusUpdate : undefined}
      showActions={selectedTab === INCOMING_LABEL}
      showPostDetails={selectedTab === INCOMING_LABEL}
    />
  );

  const renderHeader = () => (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Jobs & Applications</ThemedText>
        <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>
          Track the opportunities you have applied to, and manage incoming applicants when your business tools are active.
        </ThemedText>
      </View>

      <CategorySelector
        options={primaryTabs}
        selectedIndex={selectedIndex}
        onChange={setSelectedIndex}
      />

      <View style={styles.summaryGrid}>
        <SummaryCard
          label={selectedTab === INCOMING_LABEL ? "Incoming" : "Applied"}
          value={applicationSummary.total}
          icon="briefcase"
          cardColor={cardColor}
          borderColor={borderColor}
          iconColor={tintColor}
          labelColor={mutedTextColor}
        />
        <SummaryCard
          label="Pending"
          value={applicationSummary.pending}
          icon="clock"
          cardColor={cardColor}
          borderColor={borderColor}
          iconColor={tintColor}
          labelColor={mutedTextColor}
        />
        <SummaryCard
          label="Reviewed"
          value={applicationSummary.reviewed}
          icon="eye"
          cardColor={cardColor}
          borderColor={borderColor}
          iconColor={tintColor}
          labelColor={mutedTextColor}
        />
        <SummaryCard
          label="Accepted"
          value={applicationSummary.accepted}
          icon="check-circle"
          cardColor={cardColor}
          borderColor={borderColor}
          iconColor={tintColor}
          labelColor={mutedTextColor}
        />
      </View>

      <View style={styles.actionsRow}>
        <View style={styles.sectionText}>
          <ThemedText style={styles.sectionTitle}>{selectedTab}</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: mutedTextColor }]}>
            {selectedTab === INCOMING_LABEL
              ? selectedManagedPost
                ? "Review applicants for a specific listing, or switch to all incoming applications."
                : "Review incoming applicants across your published opportunities."
              : "Keep your active job submissions visible and easy to revisit."}
          </ThemedText>
        </View>
        <View style={styles.buttonStack}>
          {selectedTab === MY_APPLICATIONS_LABEL && (
            <ThemedButton
              title="Browse Jobs"
              variant="outline"
              onPress={() => router.push("/search")}
            >
              <View style={styles.buttonContent}>
                <Feather name="search" size={16} color={tintColor} />
                <ThemedText style={[styles.buttonText, { color: tintColor }]}>Browse Jobs</ThemedText>
              </View>
            </ThemedButton>
          )}
          {selectedTab === INCOMING_LABEL && (
            <ThemedButton
              title="Open Publishing"
              variant="outline"
              onPress={() => router.push("/profile/publishing")}
            >
              <View style={styles.buttonContent}>
                <Feather name="edit-3" size={16} color={tintColor} />
                <ThemedText style={[styles.buttonText, { color: tintColor }]}>Open Publishing</ThemedText>
              </View>
            </ThemedButton>
          )}
        </View>
      </View>

      {selectedTab === INCOMING_LABEL ? (
        <TouchableOpacity
          style={[styles.filterCard, { borderColor, backgroundColor: cardColor }]}
          onPress={() => setShowIncomingFilterModal(true)}
          activeOpacity={0.85}
        >
          <View style={styles.filterCardContent}>
            <Feather name="filter" size={16} color={tintColor} />
            <View style={styles.filterCardText}>
              <ThemedText style={styles.filterCardTitle}>
                {selectedManagedPost ? selectedManagedPost.title : "All listings"}
              </ThemedText>
              <ThemedText style={[styles.filterCardSubtitle, { color: mutedTextColor }]}>
                {selectedManagedPost
                  ? "Incoming applicants filtered to this listing"
                  : "Showing incoming applicants across all your listings"}
              </ThemedText>
            </View>
          </View>
          <Feather name="chevron-down" size={16} color={mutedTextColor} />
        </TouchableOpacity>
      ) : null}

      <CategorySelector
        options={[...STATUS_FILTERS]}
        selectedIndex={statusIndex}
        onChange={setStatusIndex}
      />
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer>
        {renderHeader()}
        <View style={styles.listContainer}>
          {[1, 2, 3].map((index) => (
            <ApplicationSkeleton key={index} />
          ))}
        </View>
      </ScreenContainer>
    );
  }

  if (authLoading) {
    return (
      <ScreenContainer>
        {renderHeader()}
        <View style={styles.listContainer}>
          {[1, 2, 3].map((index) => (
            <ApplicationSkeleton key={`auth-loading-${index}`} />
          ))}
        </View>
      </ScreenContainer>
    );
  }

  if (!user) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <Feather name="briefcase" size={32} color={tintColor} />
          <ThemedText style={styles.emptyTitle}>Sign in to track applications</ThemedText>
          <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}> 
            Your job applications and incoming applicant activity will appear here after you sign in.
          </ThemedText>
          <TouchableOpacity onPress={() => router.push("/auth/login")}>
            <ThemedText style={[styles.actionText, { color: tintColor }]}>Go to Login</ThemedText>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (activeError) {
    return (
      <ScreenContainer>
        {renderHeader()}
        <View style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>Error loading applications</ThemedText>
          <TouchableOpacity onPress={handleRefresh}>
            <ThemedText style={[styles.actionText, { color: tintColor }]}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const activeData = selectedTab === INCOMING_LABEL ? filteredIncomingApplications : filteredMyApplications;

  return (
    <ScreenContainer>
      <ActionPromptModal
        visible={!!pendingStatusUpdate}
        title="Update status"
        message={
          pendingStatusUpdate
            ? `Are you sure you want to mark this application as ${pendingStatusUpdate.newStatus}?`
            : ""
        }
        cancelLabel="Cancel"
        confirmLabel="Update"
        onCancel={() => setPendingStatusUpdate(null)}
        onConfirm={async () => {
          if (!pendingStatusUpdate) return;
          const { applicationId, newStatus } = pendingStatusUpdate;
          setPendingStatusUpdate(null);
          try {
            const result = await updateApplicationStatus(applicationId, newStatus);
            if (result.error) {
              toast.show({
                type: "danger",
                title: "Error",
                message: "Failed to update application status.",
              });
              return;
            }
            toast.show({
              type: "success",
              title: "Status updated",
              message: `Application marked as ${newStatus}.`,
            });
          } catch (_error) {
            toast.show({
              type: "danger",
              title: "Error",
              message: "An unexpected error occurred.",
            });
          }
        }}
      />
      <SelectionPromptModal
        visible={showIncomingFilterModal}
        title="Filter incoming applicants"
        message="Choose a listing to narrow the incoming applicants view."
        options={[
          {
            label: "All listings",
            onPress: () => {
              setSelectedIncomingPostId(null);
              setShowIncomingFilterModal(false);
            },
          },
          ...myJobPosts.map((post: any) => ({
            label: post.title,
            onPress: () => {
              setSelectedIncomingPostId(post.id);
              setShowIncomingFilterModal(false);
            },
          })),
        ]}
        cancelLabel="Close"
        onCancel={() => setShowIncomingFilterModal(false)}
      />
      <FlatList
        removeClippedSubviews={false}
        data={activeData}
        keyExtractor={(item: any) => item.id}
        renderItem={renderApplicationItem}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tintColor} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name={selectedTab === INCOMING_LABEL ? "users" : "briefcase"} size={36} color={mutedTextColor} />
            <ThemedText style={styles.emptyTitle}>
              {selectedTab === INCOMING_LABEL
                ? selectedIncomingPostId
                  ? "No applicants for this listing yet"
                  : "No incoming applications yet"
                : "No applications yet"}
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}> 
              {selectedTab === INCOMING_LABEL
                ? "When people apply to your opportunities, they will appear here."
                : "Once you apply to jobs, they will show up here so you can track progress."}
            </ThemedText>
            {selectedTab === MY_APPLICATIONS_LABEL && (
              <ThemedButton
                title="Explore jobs"
                onPress={() => router.push("/search")}
              >
                <View style={styles.buttonContent}>
                  <ThemedText style={[styles.primaryButtonText, { color: backgroundColor }]}>
                    Explore jobs
                  </ThemedText>
                  <Feather name="arrow-right" size={16} color={backgroundColor} />
                </View>
              </ThemedButton>
            )}
          </View>
        }
      />
    </ScreenContainer>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  cardColor,
  borderColor,
  iconColor,
  labelColor,
}: {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof Feather>["name"];
  cardColor: string;
  borderColor: string;
  iconColor: string;
  labelColor: string;
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor }]}>
      <Feather name={icon} size={18} color={iconColor} />
      <ThemedText style={styles.summaryValue}>{value}</ThemedText>
      <ThemedText style={[styles.summaryLabel, { color: labelColor }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
  },
  subtitle: {
    fontSize: Typography.sm,
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  summaryCard: {
    width: "48.5%",
    minHeight: 112,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 6,
    justifyContent: "space-between",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: Typography.semibold,
  },
  summaryLabel: {
    fontSize: 13,
  },
  actionsRow: {
    marginHorizontal: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  sectionText: {
    flex: 1,
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
  },
  sectionSubtitle: {
    fontSize: Typography.sm,
    lineHeight: 20,
  },
  buttonStack: {
    minWidth: 120,
  },
  filterCard: {
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  filterCardContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  filterCardText: {
    flex: 1,
    gap: 2,
  },
  filterCardTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  filterCardSubtitle: {
    fontSize: Typography.xs,
    lineHeight: 18,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  buttonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  primaryButtonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: "#ffffff",
  },
  listContainer: {
    paddingBottom: Spacing.xl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  errorText: {
    fontSize: Typography.base,
    marginBottom: Spacing.md,
  },
  actionText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    textAlign: "center",
  },
  emptyText: {
    fontSize: Typography.base,
    textAlign: "center",
    lineHeight: 22,
  },
});
