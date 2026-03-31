import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  ScrollView,
  Image,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { ThemedInput } from "@/components/ThemedInput";
import { ThemedText } from "@/components/ThemedText";
import Button from "@/components/ui/Button";
import { Post, PostType } from "@/types";
import { usePostForm } from "./usePostForm";
import PostTypeSelector from "./PostTypeSelector";
import JobFields from "./JobFields";
import ArticleFields from "./ArticleFields";
import { ImagePickerField } from "./ImagePickerField";
import * as Haptics from "expo-haptics";
import { useFlashToast } from "@/components/ui/Flash";
import { Spacing, Typography, BorderRadius } from "@/constants/DesignSystem";
import { useThemeColor } from "@/hooks";
import { formatDeadlineLabel } from "@/utils/postVisibility";

const formatSalaryLabel = (salary?: string) =>
  salary ? salary.replace(/\$/g, "N$") : salary;

export enum WizardStep {
  BasicInfo = 0,
  DetailsInfo = 1,
  Review = 2,
}

interface PostFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialPost?: Post | null;
}

export default function PostForm({ onSuccess, onCancel, initialPost }: PostFormProps) {
  const toast = useFlashToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    WizardStep.BasicInfo
  );
  const progressAnim = useRef(new Animated.Value(0)).current;

  const {
    title,
    setTitle,
    content,
    setContent,
    imageUrl,
    handleImageSelected,
    loading,
    postType,
    handlePostTypeChange,
    jobFields,
    setJobFields,
    articleFields,
    setArticleFields,
    handleSubmit,
    isFormValid,
  } = usePostForm(onSuccess, initialPost);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentStep / 2,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep, progressAnim]);

  const handleNextStep = () => {
    if (currentStep === WizardStep.BasicInfo) {
      if (!title.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast.show({
          type: "danger",
          title: "Missing title",
          message: "Please enter a title for your post.",
        });
        return;
      }
      if (!content.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast.show({
          type: "danger",
          title: "Missing content",
          message: "Please enter content for your post.",
        });
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentStep(WizardStep.DetailsInfo);
    } else if (currentStep === WizardStep.DetailsInfo) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentStep(WizardStep.Review);
    } else if (currentStep === WizardStep.Review) {
      handleSubmit();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = () => {
    onCancel?.();
  };

  // Theme colors for review step
  const textColor = useThemeColor({}, "text");
  const mutedTextColor = useThemeColor({}, "mutedText");

  const renderStepContent = () => {
    switch (currentStep) {
      case WizardStep.BasicInfo:
        return (
          <View style={{ gap: Spacing.md }}>
            {!initialPost ? (
              <PostTypeSelector
                selectedPostType={postType}
                onPostTypeChange={handlePostTypeChange}
              />
            ) : null}
            <ThemedInput
              placeholder="Enter a title for your post"
              value={title}
              maxLength={80}
              onChangeText={setTitle}
            />
            <ThemedInput
              placeholder="What would you like to share?"
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              style={{ minHeight: 80, maxHeight: 120 }}
            />
            <ImagePickerField
              selectedImage={imageUrl}
              onImageSelected={handleImageSelected}
              label="Add Image"
            />
          </View>
        );
      case WizardStep.DetailsInfo:
        return postType === PostType.Job ? (
          <JobFields values={jobFields} onChange={setJobFields} />
        ) : (
          <ArticleFields values={articleFields} onChange={setArticleFields} />
        );
      case WizardStep.Review:
        return (
          <View style={[styles.reviewContainer]}>
            {imageUrl && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.reviewImage}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Content */}
            <View style={styles.contentSection}>
              <ThemedText
                style={[styles.contentText, { color: textColor }]}
                numberOfLines={2}
              >
                {title}
              </ThemedText>
            </View>

            <View style={styles.contentSection}>
              <ThemedText
                style={[styles.contentText, { color: mutedTextColor }]}
                numberOfLines={3}
              >
                {content}
              </ThemedText>
            </View>

            {/* Post Details */}
            <View style={styles.detailsSection}>
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <ThemedText
                    style={[styles.detailLabel, { color: mutedTextColor }]}
                  >
                    Type
                  </ThemedText>
                  <ThemedText
                    style={[styles.detailValue, { color: textColor }]}
                  >
                    {postType === PostType.Job ? "Job Posting" : "News Article"}
                  </ThemedText>
                </View>

                {postType === PostType.Job && jobFields.company && (
                  <View style={styles.detailItem}>
                    <ThemedText
                      style={[styles.detailLabel, { color: mutedTextColor }]}
                    >
                      Company
                    </ThemedText>
                    <ThemedText
                      style={[styles.detailValue, { color: textColor }]}
                    >
                      {jobFields.company}
                    </ThemedText>
                  </View>
                )}

                {postType === PostType.News && articleFields.company && (
                  <View style={styles.detailItem}>
                    <ThemedText
                      style={[styles.detailLabel, { color: mutedTextColor }]}
                    >
                      Company
                    </ThemedText>
                    <ThemedText
                      style={[styles.detailValue, { color: textColor }]}
                    >
                      {articleFields.company}
                    </ThemedText>
                  </View>
                )}

                {postType === PostType.Job && jobFields.location && (
                  <View style={styles.detailItem}>
                    <ThemedText
                      style={[styles.detailLabel, { color: mutedTextColor }]}
                    >
                      Location
                    </ThemedText>
                    <ThemedText
                      style={[styles.detailValue, { color: textColor }]}
                    >
                      {jobFields.location}
                    </ThemedText>
                  </View>
                )}

                {postType === PostType.Job && jobFields.salary && (
                  <View style={styles.detailItem}>
                    <ThemedText
                      style={[styles.detailLabel, { color: mutedTextColor }]}
                    >
                      Salary
                    </ThemedText>
                    <ThemedText
                      style={[styles.detailValue, { color: textColor }]}
                    >
                      {formatSalaryLabel(jobFields.salary)}
                    </ThemedText>
                  </View>
                )}

                {postType === PostType.Job && jobFields.deadline && (
                  <View style={styles.detailItem}>
                    <ThemedText
                      style={[styles.detailLabel, { color: mutedTextColor }]}
                    >
                      End Date
                    </ThemedText>
                    <ThemedText
                      style={[styles.detailValue, { color: textColor }]}
                    >
                      {formatDeadlineLabel(jobFields.deadline)}
                    </ThemedText>
                  </View>
                )}

                {postType === PostType.News && articleFields.industry && (
                  <View style={styles.detailItem}>
                    <ThemedText
                      style={[styles.detailLabel, { color: mutedTextColor }]}
                    >
                      Industry
                    </ThemedText>
                    <ThemedText
                      style={[styles.detailValue, { color: textColor }]}
                    >
                      {articleFields.industry}
                    </ThemedText>
                  </View>
                )}

                {postType === PostType.News && articleFields.source && (
                  <View style={styles.detailItem}>
                    <ThemedText
                      style={[styles.detailLabel, { color: mutedTextColor }]}
                    >
                      Source
                    </ThemedText>
                    <ThemedText
                      style={[styles.detailValue, { color: textColor }]}
                    >
                      {articleFields.source}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  const atFirstStep = currentStep === 0;
  const atLastStep = currentStep === 2;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }}>
        {/* Progress Indicator */}
        <View
          style={{
            paddingVertical: Spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: Spacing.xs,
              marginBottom: Spacing.md,
            }}
          >
            {[0, 1, 2].map((step) => (
              <View
                key={step}
                style={{
                  flex: 1,
                  height: 3,
                  backgroundColor: step <= currentStep ? "#525252" : "#333",
                  borderRadius: 2,
                }}
              />
            ))}
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: Spacing.lg,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="interactive"
        >
          {renderStepContent()}
        </ScrollView>

        {/* Navigation */}
        <View
          style={{
            padding: Spacing.lg,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <ThemedText
            style={{
              color: atFirstStep ? "#666" : "#525252",
              fontSize: 16,
              fontWeight: "500",
            }}
            onPress={atFirstStep ? handleCancel : handlePrevStep}
          >
            {atFirstStep ? "Cancel" : "Back"}
          </ThemedText>

            <Button
            title={atLastStep ? (initialPost ? "Save" : "Post") : "Next"}
            onPress={handleNextStep}
            loading={loading}
            disabled={!isFormValid}
            variant="ghost"
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  reviewContainer: {
    gap: Spacing.md,
  },
  imageContainer: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  reviewImage: {
    width: "100%",
    height: "100%",
  },
  contentSection: {},
  contentText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  detailsSection: {},
  detailsGrid: {
    gap: Spacing.sm,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: BorderRadius.md,
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

