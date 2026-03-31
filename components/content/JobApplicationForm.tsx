import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, TouchableOpacity, View } from "react-native";
import { ThemedInput } from "@/components/ThemedInput";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Post, Document, DocumentType } from "@/types";
import {
  useAuth,
  useApplications,
  useDocuments,
  useApplicationNotifications,
} from "@/hooks";
import {
  JobApplicationSkeleton,
  CoverLetterSkeleton,
} from "@/components/ui/Skeleton";

import DocumentCard from "./DocumentCard";
import DocumentManager from "./DocumentManager";
import * as Haptics from "expo-haptics";
import { useFlashToast } from "@/components/ui/Flash";
import {
  generateStatusUpdateEmail,
  sendEmailViaEdgeFunction,
} from "@/utils/emailService";
import { supabase } from "@/utils/supabase";

export enum ApplicationStep {
  CVSelection = 0,
  CoverLetter = 1,
  Review = 2,
}

interface JobApplicationFormProps {
  jobPost: Post;
  onSuccess?: () => void;
  style?: any;
}

function isDuplicateApplicationError(error: any) {
  if (!error) return false;

  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const hint = String(error.hint || "").toLowerCase();
  const combined = `${message} ${details} ${hint}`;

  return (
    error.code === "23505" &&
    (combined.includes("applications_user_id_post_id_key") ||
      combined.includes("applications_applicant_id_job_id_key") ||
      combined.includes("applications_applicant_id_post_id_key") ||
      combined.includes("applications_unique_per_job") ||
      combined.includes("duplicate key") ||
      combined.includes("already exists"))
  );
}

const resolveCompanyId = (criteria: Post["criteria"]) =>
  criteria?.companyId || criteria?.company_id || null;

export default function JobApplicationForm({
  jobPost,
  onSuccess,
}: JobApplicationFormProps) {
  const toast = useFlashToast();
  const { user, profile } = useAuth();
  const { addApplication, checkIfApplied } = useApplications();
  const { fetchDocuments, loading: documentsLoading } = useDocuments(user?.id);
  const { notifyNewApplication } = useApplicationNotifications();

  const [currentStep, setCurrentStep] = useState<ApplicationStep>(
    ApplicationStep.CVSelection
  );
  const [loading, setLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [selectedResume, setSelectedResume] = useState<Document | null>(null);
  const [selectedCoverLetter, setSelectedCoverLetter] =
    useState<Document | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isActive = true;

    const checkApplication = async () => {
      if (!user?.id) {
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      setHasApplied(false);

      try {
        const [{ hasApplied: appliedStatus }] = await Promise.all([
          checkIfApplied(user.id, jobPost.id),
          Promise.all([
            fetchDocuments(DocumentType.CV),
            fetchDocuments(DocumentType.CoverLetter),
          ]),
        ]);

        if (isActive && appliedStatus) {
          setHasApplied(true);
        }
      } catch {
        // Silently handle errors in production
      } finally {
        if (isActive) {
          setIsChecking(false);
        }
      }
    };

    checkApplication();

    return () => {
      isActive = false;
    };
  }, [user?.id, jobPost.id, checkIfApplied, fetchDocuments]);

  // Animate progress
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentStep / 2,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep, progressAnim]);

  const handleSelectResume = (document: Document) => {
    setSelectedResume(document);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSelectCoverLetter = (document: Document) => {
    setSelectedCoverLetter(document);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNextStep = () => {
    if (currentStep === ApplicationStep.CVSelection) {
      if (!selectedResume) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast.show({
          type: "danger",
          title: "Missing CV",
          message: "Please select a CV to continue.",
        });
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentStep(ApplicationStep.CoverLetter);
    } else if (currentStep === ApplicationStep.CoverLetter) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentStep(ApplicationStep.Review);
    } else if (currentStep === ApplicationStep.Review) {
      handleSubmit();
    }
  };

  const handlePrevStep = () => {
    if (currentStep === ApplicationStep.CoverLetter) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(ApplicationStep.CVSelection);
    } else if (currentStep === ApplicationStep.Review) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(ApplicationStep.CoverLetter);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedResume) return;
    setLoading(true);
    try {
      const applicantName =
        profile?.name && profile?.surname
          ? `${profile.name} ${profile.surname}`
          : profile?.full_name || profile?.username || null;

      const { data, error } = await addApplication({
        user_id: user.id,
        post_id: jobPost.id,
        resume_id: selectedResume.id,
        resume_url: selectedResume.file_url,
        cover_letter: coverLetter.trim() || null,
        cover_letter_id: selectedCoverLetter?.id || null,
        applicant_name_snapshot: applicantName,
        applicant_phone_snapshot: profile?.phone || null,
        job_title_snapshot: jobPost.title || null,
        cv_document_id_snapshot: selectedResume.id,
        application_snapshot: {
          applicant: {
            id: user.id,
            full_name: applicantName,
            phone: profile?.phone || null,
          },
          job: {
            id: jobPost.id,
            title: jobPost.title || null,
          },
          submitted_cv_document_id: selectedResume.id,
        },
      });
      if (error) throw error;

      const createdApplication = Array.isArray(data) ? data[0] : data;

      // Send notification to job poster
      if (profile && jobPost.user_id && jobPost.user_id !== user.id) {
        try {
          await notifyNewApplication(
            createdApplication?.id || jobPost.id,
            jobPost.user_id,
            applicantName || "Someone",
            jobPost.title || "your job"
          );
        } catch (notificationError) {
          console.error(
            "Error notifying job poster about new application:",
            notificationError
          );
        }
      }

      const companyId = resolveCompanyId(jobPost.criteria);
      if (companyId && createdApplication) {
        try {
          const { data: company } = await supabase
            .from("companies")
            .select("id, name, logo_url, user_id, contact_email")
            .eq("id", companyId)
            .maybeSingle();

          if (company) {
            let ownerEmail = company.contact_email || null;

            if (!ownerEmail && company.user_id) {
              const { data: ownerProfile } = await supabase
                .from("legacy_public_profiles")
                .select("username")
                .eq("id", company.user_id)
                .maybeSingle();

              if (ownerProfile?.username) {
                ownerEmail = `${ownerProfile.username}@growork.com`;
              }
            }

            if (ownerEmail) {
              const emailHTML = generateStatusUpdateEmail(
                {
                  ...createdApplication,
                  user_id: user.id,
                  applicant_name_snapshot: applicantName,
                  applicant_phone_snapshot: profile?.phone || null,
                  job_title_snapshot: jobPost.title || null,
                  resume_url: selectedResume.file_url,
                  cover_letter: coverLetter.trim() || selectedCoverLetter?.file_url || null,
                  documents: [
                    {
                      id: selectedResume.id,
                      type: "cv",
                      name: selectedResume.name,
                      file_url: selectedResume.file_url,
                    },
                    ...(selectedCoverLetter
                      ? [
                          {
                            id: selectedCoverLetter.id,
                            type: "cover_letter",
                            name: selectedCoverLetter.name,
                            file_url: selectedCoverLetter.file_url,
                          },
                        ]
                      : []),
                  ],
                  posts: {
                    ...jobPost,
                    created_at: jobPost.created_at,
                  },
                  profiles: {
                    username: profile?.username || null,
                    name: profile?.name || null,
                    surname: profile?.surname || null,
                    profession: profile?.profession || null,
                    phone: profile?.phone || null,
                    website: profile?.website || null,
                    location: profile?.location || null,
                    experience_years: profile?.experience_years || null,
                    education: profile?.education || null,
                    skills: profile?.skills || null,
                    bio: profile?.bio || null,
                  },
                  companies: company,
                },
                "pending"
              );

              await sendEmailViaEdgeFunction({
                to: ownerEmail,
                subject: `New application for ${jobPost.title || "your job listing"}`,
                html: emailHTML,
              });
            }
          }
        } catch (emailError) {
          console.error("Error emailing company owner about new application:", emailError);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({
        type: "success",
        title: "Application submitted",
        message: "Your application has been sent successfully.",
      });
      setHasApplied(true);
    } catch (error: any) {
      // Handle duplicate application error specifically
      if (isDuplicateApplicationError(error)) {
        setHasApplied(true);
        toast.show({
          type: "info",
          title: "Already Applied",
          message: "You have already applied to this position.",
        });
      } else {
        toast.show({
          type: "danger",
          title: "Error",
          message: "Failed to submit application. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    // Show applied status if user has already applied
    if (hasApplied) {
      return (
        <View style={{ padding: 20, alignItems: "center" }}>
          <View
            style={{
              backgroundColor: "#10b981",
              borderRadius: 50,
              width: 80,
              height: 80,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <ThemedText style={{ color: "#fff", fontSize: 24 }}>✓</ThemedText>
          </View>
          <ThemedText
            type="title"
            style={{ marginBottom: 8, textAlign: "center" }}
          >
            Application Submitted
          </ThemedText>
          <ThemedText
            style={{ textAlign: "center", opacity: 0.7, marginBottom: 20 }}
          >
            You have already applied to this position. You can track your
            application progress in the Applications tab or check your email for
            updates from the employer.
          </ThemedText>
          <TouchableOpacity
            style={{
              backgroundColor: "#10b981",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
            onPress={() => onSuccess?.()}
          >
            <ThemedText style={{ color: "#fff", fontWeight: "600" }}>
              Close
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    switch (currentStep) {
      case ApplicationStep.CVSelection:
        if (documentsLoading) {
          return <JobApplicationSkeleton />;
        }
        return (
          <>
            <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
              Select Your CV
            </ThemedText>
            <DocumentManager
              userId={user?.id}
              documentType={DocumentType.CV}
              selectable
              onSelect={handleSelectResume}
              disableScrolling={true}
            />
          </>
        );
      case ApplicationStep.CoverLetter:
        if (documentsLoading) {
          return <CoverLetterSkeleton />;
        }
        return (
          <>
            <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
              Cover Letter (Optional)
            </ThemedText>

            <ThemedInput
              value={coverLetter}
              onChangeText={setCoverLetter}
              placeholder="Tell us why you're a good fit for this position..."
              multiline
              numberOfLines={6}
              style={{
                width: "100%",
                minHeight: 120,
                textAlignVertical: "top",
                paddingTop: 12,
                marginBottom: 12,
              }}
            />

            <DocumentManager
              userId={user?.id}
              documentType={DocumentType.CoverLetter}
              selectable
              onSelect={handleSelectCoverLetter}
              disableScrolling={true}
            />
          </>
        );
      case ApplicationStep.Review:
        return (
          <View style={{ padding: 16 }}>
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
              Review Your Application
            </ThemedText>

            <View style={{ marginBottom: 12 }}>
              <ThemedText style={{ fontWeight: "600", marginBottom: 4 }}>
                Position:
              </ThemedText>
              <ThemedText>{jobPost.title}</ThemedText>
            </View>

            <View style={{ marginBottom: 12 }}>
              <ThemedText style={{ fontWeight: "600", marginBottom: 4 }}>
                CV:
              </ThemedText>
              {selectedResume && (
                <DocumentCard document={selectedResume} showMenu={false} />
              )}
            </View>

            <View style={{ marginBottom: 12 }}>
              <ThemedText style={{ fontWeight: "600", marginBottom: 4 }}>
                Cover Letter:
              </ThemedText>
              {coverLetter ? (
                <ThemedView
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    marginBottom: 8,
                  }}
                >
                  <ThemedText>{coverLetter}</ThemedText>
                </ThemedView>
              ) : selectedCoverLetter ? (
                <DocumentCard document={selectedCoverLetter} showMenu={false} />
              ) : (
                <ThemedText style={{ fontStyle: "italic", opacity: 0.6 }}>
                  No cover letter provided
                </ThemedText>
              )}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  // Show loading while checking application status
  if (isChecking) {
    return <JobApplicationSkeleton />;
  }

  // Show applied status immediately if user has already applied
  if (hasApplied) {
    return (
      <View style={{ padding: 20, alignItems: "center" }}>
        <View
          style={{
            backgroundColor: "#10b981",
            borderRadius: 50,
            width: 80,
            height: 80,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <ThemedText style={{ color: "#fff", fontSize: 24 }}>✓</ThemedText>
        </View>
        <ThemedText
          type="title"
          style={{ marginBottom: 8, textAlign: "center" }}
        >
          Application Submitted
        </ThemedText>
        <ThemedText style={{ textAlign: "center", opacity: 0.7 }}>
          You have already applied to this position. You can track your
          application progress in the Applications tab or check your email for
          updates from the employer.
        </ThemedText>
      </View>
    );
  }

  const atFirstStep = currentStep === ApplicationStep.CVSelection;
  const atLastStep = currentStep === ApplicationStep.Review;

  return (
    <>
      {renderStepContent()}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable
          onPress={atFirstStep ? undefined : handlePrevStep}
          disabled={atFirstStep}
          hitSlop={10}
          style={({ pressed }) => ({
            opacity: atFirstStep ? 0.5 : pressed ? 0.7 : 1,
            paddingVertical: 8,
            paddingHorizontal: 6,
          })}
        >
          <ThemedText style={{ color: atFirstStep ? "#999" : "#525252" }}>
            {atFirstStep ? "Previous" : "← Previous"}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={handleNextStep}
          disabled={
            loading ||
            (currentStep === ApplicationStep.CVSelection && !selectedResume)
          }
          hitSlop={10}
          style={({ pressed }) => ({
            opacity:
              loading ||
              (currentStep === ApplicationStep.CVSelection && !selectedResume)
                ? 0.5
                : pressed
                  ? 0.7
                  : 1,
            paddingVertical: 8,
            paddingHorizontal: 6,
          })}
        >
          <ThemedText
            style={{
              color:
                loading ||
                (currentStep === ApplicationStep.CVSelection && !selectedResume)
                  ? "#999"
                  : "#525252",
            }}
          >
            {atLastStep ? (loading ? "Submitting..." : "Submit") : "Next →"}
          </ThemedText>
        </Pressable>
      </View>
    </>
  );
}


