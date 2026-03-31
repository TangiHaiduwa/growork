import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  StatusBar,
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useAuth, useThemeColor, useCompanies } from "@/hooks";
import { Colors, Spacing, BorderRadius } from "@/constants/DesignSystem";
import { Company, CompanyFormData, COMPANY_SIZES } from "@/types";
import { UserType } from "@/types/enums";
import { STORAGE_BUCKETS, uploadImage } from "@/utils/uploadUtils";
import { supabase } from "@/utils/supabase";
import { ThemedText } from "@/components/ThemedText";
import { ThemedAvatar } from "@/components/ui/ThemedAvatar";
import SettingsList from "@/components/ui/SettingsList";
import ScreenContainer from "@/components/ScreenContainer";
import UniversalHeader from "@/components/ui/UniversalHeader";
import BadgeSelector from "@/components/ui/BadgeSelector";
import { useFlashToast } from "@/components/ui/Flash";
import ActionPromptModal from "@/components/ui/ActionPromptModal";

const CompanyManagement = () => {
  const router = useRouter();
  const {
    id,
    prefillName,
    prefillIndustry,
    prefillLocation,
    upgradeToBusiness,
  } =
    useLocalSearchParams<{
      id?: string;
      prefillName?: string;
      prefillIndustry?: string;
      prefillLocation?: string;
      upgradeToBusiness?: string;
    }>();

  const {
    user,
    profile,
    refreshProfile,
    loading: authLoading,
    profileLoading,
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [selectedLogoUri, setSelectedLogoUri] = useState<string | null>(null);
  const [businessToggleEnabled, setBusinessToggleEnabled] = useState(false);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const toast = useFlashToast();

  const [editedCompany, setEditedCompany] = useState<CompanyFormData>({
    name: "",
    description: "",
    website: "",
    contact_email: "",
    industry: "",
    size: "",
    founded_year: "",
    location: "",
  });

  // Get theme colors
  const tintColor = useThemeColor({}, "tint");
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "border");
  const mutedTextColor = useThemeColor({}, "mutedText");

  const {
    getCompanyById,
    createCompany,
    updateCompany,
    updateCompanyLogo,
    deleteCompany,
    companies,
    companyLimit,
    hasReachedCompanyLimit,
  } = useCompanies();

  // Create styles with theme colors
  const styles = createStyles({
    tintColor,
    backgroundColor,
    textColor,
    borderColor,
    mutedTextColor,
  });
  const shouldDeferBusinessSetupDecision =
    !id &&
    upgradeToBusiness === "true" &&
    (authLoading || profileLoading || !profile);
  const isBusinessSetupFlow =
    !id &&
    upgradeToBusiness === "true" &&
    profile?.user_type !== UserType.Business;

  // Load company if `id` exists, otherwise prefill from route
  useEffect(() => {
    const init = async () => {
      if (id) {
        const result = await getCompanyById(id);
        if (!result || (result as any).error) return;
        const { company: dbCompany } = result as { company: Company };
        if (dbCompany) {
          setCompany(dbCompany);
          setEditedCompany({
            name: dbCompany.name || "",
            description: dbCompany.description || "",
            website: dbCompany.website || "",
            contact_email: dbCompany.contact_email || "",
            industry: dbCompany.industry || "",
            size: dbCompany.size || "",
            founded_year: dbCompany.founded_year?.toString() || "",
            location: dbCompany.location || "",
          });
          return;
        }
      }
      if (!id) {
        setEditedCompany((prev) => ({
          ...prev,
          name:
            prefillName && typeof prefillName === "string"
              ? decodeURIComponent(prefillName)
              : prev.name,
          industry:
            prefillIndustry && typeof prefillIndustry === "string"
              ? decodeURIComponent(prefillIndustry)
              : prev.industry,
          location:
            prefillLocation && typeof prefillLocation === "string"
              ? decodeURIComponent(prefillLocation)
              : prev.location,
        }));
      }
    };
    init();
  }, [id, prefillName, prefillIndustry, prefillLocation]);

  const handleSave = async () => {
    if (!user) return;
    if (isBusinessSetupFlow && !businessToggleEnabled) {
      toast.show({
        type: "info",
        title: "Confirm business setup",
        message:
          "Turn on the business account switch before completing the company form.",
      });
      return;
    }
    if (!id && hasReachedCompanyLimit) {
      const limitMessage = `This account can create up to ${companyLimit} company ${
        companyLimit === 1 ? "profile" : "profiles"
      }.`;
      setError(limitMessage);
      toast.show({
        type: "info",
        title: "Company limit reached",
        message: limitMessage,
      });
      return;
    }

    setLoading(true);
    setError(null);
    let upgradedProfileForCreation = false;

    try {
      const foundedYearInput = (editedCompany.founded_year || "").trim();
      const parsedYear = foundedYearInput
        ? parseInt(foundedYearInput, 10)
        : NaN;
      const foundedYearValue = Number.isFinite(parsedYear) ? parsedYear : null;

      const companyData = {
        ...editedCompany,
        founded_year: foundedYearValue,
        user_id: user.id,
        owner_id: user.id,
      };

      if (
        !id &&
        upgradeToBusiness === "true" &&
        profile?.user_type !== UserType.Business
      ) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ user_type: UserType.Business })
          .eq("id", user.id);

        if (profileError) {
          throw profileError;
        }

        upgradedProfileForCreation = true;
        await refreshProfile();

        // Some RLS policies depend on the current auth session claims.
        // Refresh the session so the company insert sees the upgraded role.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.refresh_token) {
          const { error: refreshSessionError } = await supabase.auth.refreshSession({
            refresh_token: session.refresh_token,
          });

          if (refreshSessionError) {
            throw refreshSessionError;
          }
        }
      }

      if (id) {
        // Update existing
        const res = await updateCompany(id, companyData);
        if ((res as any).error) throw new Error((res as any).error);
        if (selectedLogoUri) {
          const publicUrl = await uploadImage({
            bucket: STORAGE_BUCKETS.AVATARS,
            userId: user.id,
            uri: selectedLogoUri,
            fileNamePrefix: "company-logo",
          });
          if (!publicUrl) throw new Error("Failed to upload logo");
          await updateCompanyLogo(id, publicUrl);
          setCompany((prev) =>
            prev ? { ...prev, logo_url: publicUrl } : prev
          );
        }
      } else {
        // Create new
        const res = await createCompany(companyData);
        if ((res as any).error) throw new Error((res as any).error);
        const newCompany = (res as any).company as Company | undefined;
        if (newCompany && selectedLogoUri) {
          const publicUrl = await uploadImage({
            bucket: STORAGE_BUCKETS.AVATARS,
            userId: user.id,
            uri: selectedLogoUri,
            fileNamePrefix: "company-logo",
          });
          if (!publicUrl) throw new Error("Failed to upload logo");
          await updateCompanyLogo(newCompany.id, publicUrl);
        }
      }

      const successMessage =
        !id && upgradeToBusiness === "true"
          ? "Your business account is ready. You can now manage companies and publish as a business."
          : `Company ${id ? "updated" : "created"}!`;

      toast.show({
        type: "success",
        title: "Success",
        message: successMessage,
      });

      if (upgradeToBusiness === "true") {
        router.replace("/profile/companies");
      } else {
        router.back();
      }
    } catch (e: any) {
      if (upgradedProfileForCreation) {
        try {
          await supabase
            .from("profiles")
            .update({ user_type: UserType.User })
            .eq("id", user.id);
          await refreshProfile();
        } catch {}
      }
      setError(e.message || `Failed to save company`);
      toast.show({
        type: "danger",
        title: "Error",
        message: e.message || "Failed to save company",
      });
    } finally {
      setLoading(false);
    }
  };

  const pickLogo = async () => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    try {
      const uri = result.assets[0].uri;
      if (company) {
        const publicUrl = await uploadImage({
          bucket: STORAGE_BUCKETS.AVATARS,
          userId: user.id,
          uri,
          fileNamePrefix: "company-logo",
        });
        if (!publicUrl) throw new Error("Failed to upload logo");
        await updateCompanyLogo(company.id, publicUrl);
        setCompany({ ...company, logo_url: publicUrl });
        toast.show({
          type: "success",
          title: "Logo updated",
          message: "Your company logo is now live.",
        });
      } else {
        setSelectedLogoUri(uri);
      }
    } catch (e: any) {
      setError(e.message || "Failed to update logo");
      toast.show({
        type: "danger",
        title: "Upload failed",
        message: e.message || "Failed to update logo",
      });
    }
  };

  const handleDelete = async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setShowDeletePrompt(false);

    try {
      const result = await deleteCompany(id);
      if ((result as any).error) {
        throw new Error((result as any).error);
      }

      toast.show({
        type: "success",
        title: "Company deleted",
        message: "The company profile has been removed.",
      });
      router.replace("/profile/companies");
    } catch (e: any) {
      toast.show({
        type: "danger",
        title: "Delete failed",
        message: e.message || "Failed to delete company",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <StatusBar barStyle="dark-content" />
        <UniversalHeader
          title={id ? "Edit Company" : "Create Company"}
          showBackButton={true}
          showNotifications={false}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={styles.loadingText}>
            Loading company details...
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  if (shouldDeferBusinessSetupDecision) {
    return (
      <ScreenContainer>
        <StatusBar barStyle="dark-content" />
        <UniversalHeader
          title={id ? "Edit Company" : "Create Company"}
          showBackButton={true}
          showNotifications={false}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={styles.loadingText}>
            Preparing company setup...
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ActionPromptModal
        visible={showDeletePrompt}
        title="Delete company?"
        message="This will permanently remove the company profile from your account."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onCancel={() => setShowDeletePrompt(false)}
        onConfirm={handleDelete}
      />
      <StatusBar barStyle="dark-content" />

      <UniversalHeader
        title={id ? "Edit Company" : "Create Company"}
        showBackButton={true}
        showNotifications={false}
        rightAction={
          isBusinessSetupFlow && !businessToggleEnabled
            ? undefined
            : {
                text: id ? "Update" : "Save",
                onPress: handleSave,
              }
        }
      />

      {isBusinessSetupFlow ? (
        <View style={styles.businessSetupCard}>
          <View style={styles.businessSetupHeader}>
            <View style={styles.businessSetupText}>
              <ThemedText style={styles.businessSetupTitle}>
                Switch to Business Account
              </ThemedText>
              <ThemedText
                style={[styles.businessSetupSubtitle, { color: mutedTextColor }]}
              >
                Turn this on to confirm that you want to create a business
                account, then fill in your company details below.
              </ThemedText>
            </View>
            <Switch
              value={businessToggleEnabled}
              onValueChange={setBusinessToggleEnabled}
              trackColor={{ false: borderColor, true: tintColor }}
              thumbColor={businessToggleEnabled ? backgroundColor : "#ffffff"}
              ios_backgroundColor={borderColor}
            />
          </View>
        </View>
      ) : null}

      {!isBusinessSetupFlow || businessToggleEnabled ? (
        <>
          {/* Logo picker */}
          <Pressable onPress={pickLogo} style={styles.logoPicker}>
            <ThemedAvatar
              image={
                selectedLogoUri ||
                company?.logo_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  editedCompany.name || "Company"
                )}&size=80`
              }
              size={80}
            >
              <View style={[styles.logoOverlay, { backgroundColor: tintColor }]}>
                <Feather name="camera" size={16} color={backgroundColor} />
              </View>
            </ThemedAvatar>
          </Pressable>

          {/* Editable fields */}
          {!id ? (
            <View style={styles.limitInfoContainer}>
              <ThemedText style={styles.limitInfoText}>
                {hasReachedCompanyLimit
                  ? `You have reached this account's company limit of ${companyLimit}.`
                  : `${Math.max(companyLimit - companies.length, 0)} of ${companyLimit} company slots remaining.`}
              </ThemedText>
            </View>
          ) : null}
          <SettingsList
            sections={[
              {
                title: "Basic Information",
                data: [
                  {
                    title: "Company Name",
                    subtitle: editedCompany.name || "Not set",
                    icon: "home",
                    showTextInput: true,
                    textInputValue: editedCompany.name,
                    textInputPlaceholder: "Enter company name",
                    onTextInputChange: (text: string) =>
                      setEditedCompany((p) => ({ ...p, name: text })),
                  },
                  {
                    title: "Description",
                    subtitle: editedCompany.description || "No description",
                    icon: "file-text",
                    showTextInput: true,
                    textInputValue: editedCompany.description,
                    textInputPlaceholder: "Describe your company...",
                    onTextInputChange: (text: string) =>
                      setEditedCompany((p) => ({ ...p, description: text })),
                    textInputProps: { multiline: true, numberOfLines: 3 },
                  },
                  {
                    title: "Industry",
                    subtitle: editedCompany.industry || "Not set",
                    icon: "briefcase",
                    showTextInput: true,
                    textInputValue: editedCompany.industry,
                    textInputPlaceholder: "e.g., Technology, Healthcare",
                    onTextInputChange: (text: string) =>
                      setEditedCompany((p) => ({ ...p, industry: text })),
                  },
                ],
              },
              {
                title: "Company Details",
                data: [
                  {
                    title: "Website",
                    subtitle: editedCompany.website || "Not set",
                    icon: "globe",
                    showTextInput: true,
                    textInputValue: editedCompany.website,
                    textInputPlaceholder: "https://example.com",
                    onTextInputChange: (text: string) =>
                      setEditedCompany((p) => ({ ...p, website: text })),
                  },
                  {
                    title: "Contact Email",
                    subtitle: editedCompany.contact_email || "Not set",
                    icon: "mail",
                    showTextInput: true,
                    textInputValue: editedCompany.contact_email,
                    textInputPlaceholder: "hr@company.com",
                    onTextInputChange: (text: string) =>
                      setEditedCompany((p) => ({ ...p, contact_email: text })),
                    textInputProps: {
                      keyboardType: "email-address",
                      autoCapitalize: "none",
                    },
                  },
                  {
                    title: "Company Size",
                    subtitle: editedCompany.size || "Not set",
                    icon: "users",
                    showCustomComponent: true,
                    customComponent: (
                      <BadgeSelector
                        options={COMPANY_SIZES}
                        selectedValue={editedCompany.size}
                        onValueChange={(value: string) =>
                          setEditedCompany((p) => ({ ...p, size: value }))
                        }
                        title="Select Company Size"
                      />
                    ),
                  },
                  {
                    title: "Founded Year",
                    subtitle: editedCompany.founded_year || "Not set",
                    icon: "calendar",
                    showTextInput: true,
                    textInputValue: editedCompany.founded_year,
                    textInputPlaceholder: "e.g., 2020",
                    onTextInputChange: (text: string) =>
                      setEditedCompany((p) => ({ ...p, founded_year: text })),
                    textInputProps: { keyboardType: "numeric" },
                  },
                  {
                    title: "Location",
                    subtitle: editedCompany.location || "Not set",
                    icon: "map-pin",
                    showTextInput: true,
                    textInputValue: editedCompany.location,
                    textInputPlaceholder: "City, Country",
                    onTextInputChange: (text: string) =>
                      setEditedCompany((p) => ({ ...p, location: text })),
                  },
                ],
              },
              ...(id
                ? [
                    {
                      title: "Danger Zone",
                      data: [
                        {
                          title: "Delete Company",
                          subtitle: "Remove this company profile permanently",
                          icon: "trash-2",
                          destructive: true,
                          onPress: () => setShowDeletePrompt(true),
                        },
                      ],
                    },
                  ]
                : []),
            ]}
          />
        </>
      ) : (
        <View style={styles.pendingSetupContainer}>
          <ThemedText style={[styles.pendingSetupText, { color: mutedTextColor }]}>
            Turn on the switch above to unlock the company form and finish setting up your business account.
          </ThemedText>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}
    </ScreenContainer>
  );
};

// Define styles with theme colors
const createStyles = (themeColors: {
  tintColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  mutedTextColor: string;
}) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: Spacing.md,
      color: themeColors.mutedTextColor,
    },
    logoPicker: {
      alignSelf: "center",
      marginVertical: Spacing.xl,
    },
    businessSetupCard: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: themeColors.backgroundColor,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: themeColors.borderColor,
    },
    businessSetupHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    businessSetupText: {
      flex: 1,
    },
    businessSetupTitle: {
      color: themeColors.textColor,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 4,
    },
    businessSetupSubtitle: {
      fontSize: 14,
      lineHeight: 20,
    },
    logoOverlay: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    errorContainer: {
      backgroundColor: "#FEE2E2",
      padding: Spacing.md,
      margin: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    limitInfoContainer: {
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: `${themeColors.tintColor}12`,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${themeColors.tintColor}33`,
    },
    limitInfoText: {
      color: themeColors.textColor,
      textAlign: "center",
    },
    pendingSetupContainer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xl,
    },
    pendingSetupText: {
      textAlign: "center",
      lineHeight: 20,
    },
    errorText: {
      color: Colors.error,
      textAlign: "center",
    },
  });

export default CompanyManagement;
