import React, { useCallback, memo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import { ThemedAvatar } from "../ui/ThemedAvatar";
import ThemedButton from "../ui/ThemedButton";
import PostInteractionBar from "./PostInteractionBar";
import { useThemeColor } from "@/hooks";

const formatSalaryLabel = (salary?: string) =>
  salary ? salary.replace(/\$/g, "N$") : salary;

// Types
interface CompanyHeaderProps {
  companyName?: string;
  companyLogo?: string;
  location?: string;
}

interface UserHeaderProps {
  authorName?: string;
  authorAvatarUrl?: string;
}

interface ContentCardProps {
  id?: string;
  variant: "job" | "news";
  title: string;
  description: string;
  mainImage?: string;
  createdAt?: string;
  criteria?: {
    companyId?: string;
    company_id?: string;
    company?: string;
    companyLogo?: string;
    location?: string;
    salary?: string;
    jobType?: string;
    deadline?: string;
    source?: string;
    publication_date?: string;
  };
  isVerified?: boolean;
  onPressApply?: () => void;
  hasApplied?: boolean;
  user_id?: string;
  authorName?: string;
  authorAvatarUrl?: string;
  style?: any;
  compact?: boolean;
  isSponsored?: boolean;
  isOwnedByCurrentUser?: boolean;
  ownerBadgeLabel?: string;
  ownerActionLabel?: string;
  onPressOwnerAction?: () => void;
}

// Company Header
const CompanyHeader = memo<CompanyHeaderProps>(({ companyName, companyLogo, location }) => {
  const textColor = useThemeColor({}, "text");
  const mutedTextColor = useThemeColor({}, "mutedText");
  const displayName = companyName || "Unknown Company";
  const avatarUrl =
    companyLogo ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&size=32`;

  return (
    <View style={styles.header}>
      <ThemedAvatar size={32} image={avatarUrl} square />
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <ThemedText
            style={[styles.name, { color: textColor }]}
            numberOfLines={1}
            >
              {displayName}
            </ThemedText>
          </View>
        {!!location && (
          <ThemedText
            style={[styles.subtitle, { color: mutedTextColor }]}
            numberOfLines={1}
          >
            {location}
          </ThemedText>
        )}
      </View>
    </View>
  );
});
CompanyHeader.displayName = "CompanyHeader";

// User Header
const UserHeader = memo<UserHeaderProps>(({ authorName, authorAvatarUrl }) => {
  const textColor = useThemeColor({}, "text");
  const displayName = authorName || "Unknown User";
  const avatar =
    authorAvatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&size=32`;

  return (
    <View style={styles.header}>
      <ThemedAvatar size={32} image={avatar} />
      <View style={styles.headerText}>
        <View style={styles.nameRow}>
          <ThemedText
            style={[styles.name, { color: textColor }]}
            numberOfLines={1}
          >
            {displayName}
          </ThemedText>
        </View>
      </View>
    </View>
  );
});
UserHeader.displayName = "UserHeader";

// Details
const JobDetails = memo<{ criteria?: ContentCardProps["criteria"] }>(
  ({ criteria }) => {
    const mutedTextColor = useThemeColor({}, "mutedText");
    if (!criteria) return null;

    return (
      <View style={styles.details}>
        {!!criteria.location && (
          <View style={styles.detail}>
            <Feather name="map-pin" size={12} color={mutedTextColor} />
            <ThemedText
              style={[styles.detailText, { color: mutedTextColor }]}
              numberOfLines={1}
            >
              {criteria.location}
            </ThemedText>
          </View>
        )}
        {!!criteria.salary && (
          <View style={styles.detail}>
            <Feather name="dollar-sign" size={12} color={mutedTextColor} />
            <ThemedText
              style={[styles.detailText, { color: mutedTextColor }]}
              numberOfLines={1}
            >
              {formatSalaryLabel(criteria.salary)}
            </ThemedText>
          </View>
        )}
        {!!criteria.jobType && (
          <View style={styles.detail}>
            <Feather name="clock" size={12} color={mutedTextColor} />
            <ThemedText
              style={[styles.detailText, { color: mutedTextColor }]}
              numberOfLines={1}
            >
              {criteria.jobType}
            </ThemedText>
          </View>
        )}
      </View>
    );
  }
);
JobDetails.displayName = "JobDetails";

const NewsDetails = memo<{ criteria?: ContentCardProps["criteria"] }>(
  ({ criteria }) => {
    const mutedTextColor = useThemeColor({}, "mutedText");
    if (!criteria?.publication_date) return null;

    return (
      <View style={styles.details}>
        <View style={styles.detail}>
          <Feather name="calendar" size={12} color={mutedTextColor} />
          <ThemedText
            style={[styles.detailText, { color: mutedTextColor }]}
            numberOfLines={1}
          >
            {new Date(criteria.publication_date).toLocaleDateString()}
          </ThemedText>
        </View>
      </View>
    );
  }
);
NewsDetails.displayName = "NewsDetails";

// Main
const ContentCard = memo<ContentCardProps>(
  ({
    id,
    variant,
    title,
    description,
    mainImage,
    criteria,
    onPressApply,
    hasApplied = false,
    user_id,
    authorName,
    authorAvatarUrl,
    style,
    compact = false,
    isSponsored = false,
    isOwnedByCurrentUser = false,
    ownerBadgeLabel = "Your listing",
    ownerActionLabel = "Manage",
    onPressOwnerAction,
  }) => {
    const router = useRouter();
    const textColor = useThemeColor({}, "text");
    const mutedTextColor = useThemeColor({}, "mutedText");
    const borderColor = useThemeColor({}, "border");
    const backgroundTertiary = useThemeColor({}, "backgroundTertiary");
    const resolvedCompanyId = criteria?.companyId || criteria?.company_id;

    const handlePress = useCallback(() => {
      if (id) router.push(`/post/${id}`);
    }, [id, router]);

    const handleCompanyPress = useCallback(() => {
      if (resolvedCompanyId) router.push(`/company/${resolvedCompanyId}`);
    }, [resolvedCompanyId, router]);

    const handleUserPress = useCallback(() => {
      if (user_id) router.push(`/profile`);
    }, [user_id, router]);

    const handleApplyPress = useCallback(() => {
      onPressApply?.();
    }, [onPressApply]);

    return (
      <ThemedView
        style={[
          {
            borderBottomColor: borderColor + "20",
            paddingHorizontal: compact ? 0 : 16,
            paddingVertical: compact ? 12 : 16,
          },
          style,
        ]}
      >
        {/* Header */}
        <Pressable
          style={styles.headerContainer}
          onPress={
            resolvedCompanyId
              ? handleCompanyPress
              : criteria?.company
              ? undefined
              : handleUserPress
          }
        >
          {resolvedCompanyId || criteria?.company ? (
            <CompanyHeader
              companyName={criteria.company}
              companyLogo={criteria.companyLogo}
              location={criteria.location}
            />
          ) : (
            <UserHeader
              authorName={authorName}
              authorAvatarUrl={authorAvatarUrl}
            />
          )}
          {isOwnedByCurrentUser && variant === "job" ? (
            <View
              style={[
                styles.ownerBadge,
                {
                  backgroundColor: backgroundTertiary,
                  borderColor: borderColor + "50",
                },
              ]}
            >
              <ThemedText style={[styles.ownerBadgeText, { color: textColor }]}>
                {ownerBadgeLabel}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>

        {/* Content */}
        <Pressable style={styles.contentContainer} onPress={handlePress}>
          {!!mainImage && (
            <Image
              source={{ uri: mainImage }}
              style={styles.image}
              contentFit="cover"
            />
          )}

          <ThemedText
            style={[styles.title, { color: textColor }]}
            numberOfLines={2}
          >
            {title}
          </ThemedText>

          <ThemedText
            style={[styles.description, { color: mutedTextColor }]}
            numberOfLines={3}
          >
            {description}
          </ThemedText>

          {variant === "job" ? (
            <JobDetails criteria={criteria} />
          ) : (
            <NewsDetails criteria={criteria} />
          )}
        </Pressable>

        {/* Actions */}
        <View style={styles.actions}>
          <PostInteractionBar
            postId={id || ""}
            postOwnerId={user_id}
            variant="horizontal"
            size="small"
          />

          {isOwnedByCurrentUser ? (
            <ThemedButton
              title={ownerActionLabel}
              onPress={onPressOwnerAction || handlePress}
              variant="primary"
              size="small"
            />
          ) : null}

          {variant === "job" && !isOwnedByCurrentUser ? (
            <ThemedButton
              title={hasApplied ? "Applied" : "Apply"}
              onPress={handleApplyPress}
              disabled={hasApplied}
              variant={hasApplied ? "secondary" : "primary"}
              size="small"
            />
          ) : null}

          {variant === "news" && (
            <ThemedButton
              title="Read"
              onPress={handlePress}
              variant="primary"
              size="small"
            />
          )}

          {isSponsored && (
            <ThemedText style={[styles.sponsored, { color: mutedTextColor }]}>
              Sponsored
            </ThemedText>
          )}
        </View>
      </ThemedView>
    );
  }
);
ContentCard.displayName = "ContentCard";

// Styles
const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 12,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: -5,
  },
  contentContainer: {
    marginBottom: 12,
  },
  image: {
    width: "100%",
    height: 250,
    borderRadius: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
    lineHeight: 20,
  },
  description: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  details: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ownerBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sponsored: {
    fontSize: 12,
    fontWeight: "500",
  },
  skeletonAvatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  skeletonName: {
    height: 14,
    width: 120,
    borderRadius: 2,
    marginBottom: 4,
  },
  skeletonSubtitle: {
    height: 10,
    width: 80,
    borderRadius: 2,
  },
});

export default ContentCard;
export type { ContentCardProps };
