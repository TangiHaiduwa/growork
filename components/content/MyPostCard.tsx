import React from "react";
import { View, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { useRouter } from "expo-router";
import { useThemeColor, MyPost } from "@/hooks";
import { ThemedText } from "@/components/ThemedText";
import { Typography, Spacing, BorderRadius } from "@/constants/DesignSystem";

interface MyPostCardProps {
  post: MyPost;
  onStatusUpdate?: (postId: string, status: "active" | "inactive") => void;
  onDelete?: (postId: string) => void;
  onEdit?: (post: MyPost) => void;
}

export function MyPostCard({
  post,
  onStatusUpdate,
  onDelete,
  onEdit,
}: MyPostCardProps) {
  const router = useRouter();
  const { showActionSheetWithOptions } = useActionSheet();
  const textColor = useThemeColor({}, "text");
  const mutedTextColor = useThemeColor({}, "mutedText");
  const companyName =
    post.criteria?.company || post.company_name || `${post.profiles?.name || ""} ${post.profiles?.surname || ""}`.trim();
  const companyLogo =
    post.criteria?.companyLogo || post.company_logo || post.profiles?.avatar_url || undefined;
  const companySubtitle =
    post.criteria?.location || post.industry || post.profiles?.profession || undefined;
  const isExpired = Boolean((post as any).is_expired);

  const getStatusColor = (isActive: boolean) => {
    if (isExpired) {
      return "#FF9500";
    }

    return isActive ? "#34C759" : "#FF3B30";
  };

  const getStatusIcon = (isActive: boolean) => {
    if (isExpired) {
      return "clock";
    }

    return isActive ? "check-circle" : "pause-circle";
  };

  const handleViewApplications = () => {
    router.push(`/application/${post.id}`);
  };

  const handleStatusToggle = () => {
    const newStatus = post.is_active ? "inactive" : "active";
    const action = post.is_active ? "pause" : "activate";

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Post`,
      `Are you sure you want to ${action} this post?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: () => onStatusUpdate?.(post.id, newStatus),
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete?.(post.id),
        },
      ]
    );
  };

  const openActionMenu = () => {
    const options = [
      "Edit Post",
      ...(post.type === "job" ? ["View Applications"] : []),
      post.is_active ? "Pause Post" : "Activate Post",
      "Delete Post",
      "Cancel",
    ];

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf("Delete Post");

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
      },
      (selectedIndex) => {
        const selectedOption = selectedIndex != null ? options[selectedIndex] : null;

        switch (selectedOption) {
          case "Edit Post":
            onEdit?.(post);
            break;
          case "View Applications":
            handleViewApplications();
            break;
          case "Pause Post":
          case "Activate Post":
            handleStatusToggle();
            break;
          case "Delete Post":
            handleDelete();
            break;
        }
      }
    );
  };

  return (
    <View style={styles.container}>
      {/* Image */}
      {post.image_url && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: post.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Company Info */}
        {(companyName || post.profiles) && (
          <View style={styles.companySection}>
            <View style={styles.logoContainer}>
              <Image
                source={{
                  uri:
                    companyLogo ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      companyName || "Company"
                    )}&size=128`,
                }}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>
            <View style={styles.companyDetails}>
              <ThemedText style={[styles.companyName, { color: textColor }]}>
                {companyName}
              </ThemedText>
              {companySubtitle && (
                <ThemedText
                  style={[styles.companyRole, { color: mutedTextColor }]}
                >
                  {companySubtitle}
                </ThemedText>
              )}
            </View>
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.titleSection}>
            <ThemedText
              style={[styles.title, { color: textColor }]}
              numberOfLines={2}
            >
              {post.title}
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.statusContainer}>
              <Feather
                name={getStatusIcon(post.is_active)}
                size={16}
                color={getStatusColor(post.is_active)}
              />
              <ThemedText
                style={[
                  styles.statusText,
                  { color: getStatusColor(post.is_active) },
                ]}
              >
                {isExpired ? "Expired" : post.is_active ? "Active" : "Paused"}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={openActionMenu}
            >
              <Feather
                name="more-horizontal"
                size={20}
                color={mutedTextColor}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ThemedText
          style={[styles.description, { color: mutedTextColor }]}
          numberOfLines={3}
        >
          {post.content}
        </ThemedText>

        {/* Details */}
        <View style={styles.details}>
          <View style={styles.detailItem}>
            <ThemedText style={[styles.detailLabel, { color: mutedTextColor }]}>
              Type
            </ThemedText>
            <ThemedText style={[styles.detailValue, { color: textColor }]}>
              {post.type === "job" ? "Job Posting" : "News Article"}
            </ThemedText>
          </View>

          {post.industry && (
            <View style={styles.detailItem}>
              <ThemedText
                style={[styles.detailLabel, { color: mutedTextColor }]}
              >
                Industry
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: textColor }]}>
                {post.industry}
              </ThemedText>
            </View>
          )}

          {post.type === "job" && (
            <View style={styles.detailItem}>
              <ThemedText
                style={[styles.detailLabel, { color: mutedTextColor }]}
              >
                Applications
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: textColor }]}>
                {post.applications_count}
              </ThemedText>
            </View>
          )}

          {post.type === "news" && (
            <View style={styles.detailItem}>
              <ThemedText
                style={[styles.detailLabel, { color: mutedTextColor }]}
              >
                Views
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: textColor }]}>
                {(post as any).total_views || 0}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 32,
  },
  imageContainer: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  content: {
    gap: Spacing.lg,
  },
  companySection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
  },
  logoContainer: {
    width: 48, // Larger logo
    height: 48, // Larger logo
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  companyDetails: {
    flex: 1,
    gap: 2,
  },
  companyName: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
  },
  companyRole: {
    fontSize: Typography.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  menuButton: {
    padding: 4,
  },
  description: {
    fontSize: Typography.base,
    lineHeight: 20,
  },
  details: {
    gap: Spacing.sm,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  detailValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
});
