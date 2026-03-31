import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  StatusBar,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { useAuth, useCompanies, useThemeColor } from "@/hooks";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
// import { ThemedInput } from '@/components/ThemedInput';
import { ThemedAvatar } from "@/components/ui/ThemedAvatar";
import ActionPromptModal from "@/components/ui/ActionPromptModal";
import SettingsList from "@/components/ui/SettingsList";
import ScreenContainer from "@/components/ScreenContainer";
import { UserType } from "@/types/enums";
import { supabase } from "@/utils/supabase";
import { STORAGE_BUCKETS, uploadImage } from "@/utils/uploadUtils";
import { Feather } from "@expo/vector-icons";

import { ProfileFormData, Profile } from "@/types";
import { checkProfileCompleteness } from "@/hooks/auth";
import { useFlashToast } from "@/components/ui/Flash";

export default function EditProfileNative() {
  const router = useRouter();
  const { businessUpgraded } =
    useLocalSearchParams<{ businessUpgraded?: string }>();
  const { user, profile, refreshProfile } = useAuth();
  const { companies } = useCompanies();
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");
  const borderColor = useThemeColor({}, "border");
  // const mutedTextColor = useThemeColor({}, 'mutedText');
  const tintColor = useThemeColor({}, "tint");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showBusinessUpgradePrompt, setShowBusinessUpgradePrompt] =
    useState(false);
  const toast = useFlashToast();
  const primaryCompany = companies[0];

  const [editedProfile, setEditedProfile] = useState<ProfileFormData>({
    name: "",
    surname: "",
    username: "",
    bio: "",
    user_type: UserType.User,
    website: "",
    phone: "",
    location: "",
    profession: "",
    experience_years: "",
    education: "",
    skills: "",
  });

  const settingsData = [
    {
      title: "Basic Information",
      data: [
        {
          title: "First Name",
          subtitle: "Enter your first name",
          icon: "user",
          showTextInput: true,
          textInputValue: editedProfile.name,
          textInputPlaceholder: "Enter your first name",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, name: text })),
          textInputProps: {
            autoCapitalize: "words",
            maxLength: 50,
          },
        },
        {
          title: "Last Name",
          subtitle: "Enter your last name",
          icon: "user",
          showTextInput: true,
          textInputValue: editedProfile.surname,
          textInputPlaceholder: "Enter your last name",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, surname: text })),
          textInputProps: {
            autoCapitalize: "words",
            maxLength: 50,
          },
        },
        {
          title: "Username",
          subtitle: "Enter your username",
          icon: "at-sign",
          showTextInput: true,
          textInputValue: editedProfile.username,
          textInputPlaceholder: "Enter your username",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, username: text })),
          textInputProps: {
            autoCapitalize: "none",
            maxLength: 30,
          },
        },
        {
          title: "Bio",
          subtitle: "Tell us about yourself",
          icon: "file-text",
          showTextInput: true,
          textInputValue: editedProfile.bio,
          textInputPlaceholder: "Write a short bio about yourself...",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, bio: text })),
          textInputProps: {
            multiline: true,
            numberOfLines: 2,
            maxLength: 200,
          },
        },
      ],
    },

    {
      title: "Professional Information",
      data: [
        {
          title: "Profession",
          subtitle: "Enter your profession",
          icon: "briefcase",
          showTextInput: true,
          textInputValue: editedProfile.profession,
          textInputPlaceholder: "e.g., Software Engineer",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, profession: text })),
          textInputProps: {
            autoCapitalize: "words",
            maxLength: 100,
          },
        },
        {
          title: "Experience Years",
          subtitle: "Enter years of experience",
          icon: "clock",
          showTextInput: true,
          textInputValue: editedProfile.experience_years,
          textInputPlaceholder: "e.g., 5",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, experience_years: text })),
          textInputProps: {
            keyboardType: "numeric",
            maxLength: 2,
          },
        },
        {
          title: "Education",
          subtitle: "Enter your education",
          icon: "book",
          showTextInput: true,
          textInputValue: editedProfile.education,
          textInputPlaceholder: "e.g., Bachelor of Computer Science",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, education: text })),
          textInputProps: {
            autoCapitalize: "words",
            maxLength: 200,
          },
        },
        {
          title: "Skills",
          subtitle: "Enter your skills",
          icon: "award",
          showTextInput: true,
          textInputValue: editedProfile.skills,
          textInputPlaceholder: "e.g., JavaScript, React, Node.js",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, skills: text })),
          textInputProps: {
            autoCapitalize: "words",
            maxLength: 300,
          },
        },
      ],
    },
    {
      title: "Contact Information",
      data: [
        {
          title: "Website",
          subtitle: "Enter your website",
          icon: "globe",
          showTextInput: true,
          textInputValue: editedProfile.website,
          textInputPlaceholder: "https://yourwebsite.com",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, website: text })),
          textInputProps: {
            autoCapitalize: "none",
            keyboardType: "url",
            maxLength: 100,
          },
        },
        {
          title: "Phone",
          subtitle: "Enter your phone number",
          icon: "phone",
          showTextInput: true,
          textInputValue: editedProfile.phone,
          textInputPlaceholder: "+1 (555) 123-4567",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, phone: text })),
          textInputProps: {
            keyboardType: "phone-pad",
            maxLength: 20,
          },
        },
        {
          title: "Location",
          subtitle: "Enter your location",
          icon: "map-pin",
          showTextInput: true,
          textInputValue: editedProfile.location,
          textInputPlaceholder: "City, Country",
          onTextInputChange: (text: string) =>
            setEditedProfile((prev) => ({ ...prev, location: text })),
          textInputProps: {
            autoCapitalize: "words",
            maxLength: 100,
          },
        },
      ],
    },
    {
      title: "Account Settings",
      data: [
        {
          title: "Account Email",
          subtitle: user?.email || "No email found for this account",
          icon: "mail",
        },
        {
          title:
            editedProfile.user_type === UserType.Business
              ? primaryCompany
                ? "Manage Account"
                : "Finish Business Setup"
              : "Set Up Business Account",
          subtitle:
            editedProfile.user_type === UserType.Business
              ? primaryCompany
                ? `${primaryCompany.name} is linked to your business account`
                : "Create your company profile to finish business setup"
              : "Create a company profile to unlock posting and business tools",
          icon: "briefcase",
          onPress: () => {
            if (editedProfile.user_type === UserType.Business && primaryCompany?.id) {
              router.push(`/profile/CompanyManagement?id=${primaryCompany.id}`);
              return;
            }

            setShowBusinessUpgradePrompt(true);
          },
        },
      ],
    },
  ];

  useEffect(() => {
    if (profile) {
      setEditedProfile({
        name: profile.name || "",
        surname: profile.surname || "",
        username: profile.username || "",
        bio: profile.bio || "",
        user_type: profile.user_type,
        website: profile.website || "",
        phone: profile.phone || "",
        location: profile.location || "",
        profession: profile.profession || "",
        experience_years: profile.experience_years?.toString() || "",
        education: profile.education || "",
        skills: profile.skills?.join(", ") || "",
      });

      // Notify about completeness when opening edit screen
      const completeness = checkProfileCompleteness(profile);
      if (!completeness.isComplete) {
        const required = completeness.missingRequired
          .map((k: keyof Profile) => String(k))
          .join(", ");
        toast.show({
          type: "info",
          title: "Complete your profile",
          message: required
            ? `Missing required: ${required}`
            : "Add more details to improve your profile.",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (businessUpgraded === "true") {
      toast.show({
        type: "success",
        title: "Business tools unlocked",
        message:
          "You can now create companies, publish jobs, and manage incoming applications.",
      });
    }
  }, [businessUpgraded, toast]);

  const handleSave = async () => {
    if (!user || !profile || isSaving) return;
    if (!editedProfile.name?.trim() || !editedProfile.surname?.trim()) {
      toast.show({
        type: "danger",
        title: "Required fields",
        message: "First name and last name are required.",
      });
      return;
    }
    setError(null);
    setIsSaving(true);

    try {
      const updateData = {
        name: editedProfile.name.trim(),
        surname: editedProfile.surname.trim(),
        username: editedProfile.username.trim(),
        bio: editedProfile.bio.trim(),
        user_type: profile.user_type,
        website: editedProfile.website.trim(),
        phone: editedProfile.phone.trim(),
        location: editedProfile.location.trim(),
        profession: editedProfile.profession.trim(),
        experience_years: editedProfile.experience_years
          ? parseInt(editedProfile.experience_years)
          : null,
        education: editedProfile.education.trim(),
        skills: editedProfile.skills
          ? editedProfile.skills
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
          : null,
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id);

      if (updateError) {
        throw updateError;
      }

      await refreshProfile();
      toast.show({
        type: "success",
        title: "Profile updated",
        message: "Your changes have been saved.",
      });
      router.back();
    } catch (e: any) {
      setError(e.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const pickAvatar = async () => {
    if (!user || !profile || isUploadingAvatar) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) return;
    try {
      setError(null);
      setIsUploadingAvatar(true);
      const uri = result.assets[0].uri;
      const publicUrl = await uploadImage({
        bucket: STORAGE_BUCKETS.AVATARS,
        userId: user.id,
        uri,
        fileNamePrefix: "avatar",
      });
      if (!publicUrl) throw new Error("Failed to upload avatar");
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast.show({
        type: "success",
        title: "Avatar updated",
        message: "Your profile photo is live.",
      });
    } catch (e: any) {
      setError(e.message || "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <ScreenContainer>
      <ActionPromptModal
        visible={showBusinessUpgradePrompt}
        title="Set up your business account"
        message="We’ll take you to company setup first. Once you save your company, your account will unlock business tools."
        cancelLabel="Not now"
        confirmLabel="Continue"
        onCancel={() => setShowBusinessUpgradePrompt(false)}
        onConfirm={() => {
          setShowBusinessUpgradePrompt(false);
          const params = new URLSearchParams({
            upgradeToBusiness: "true",
          });
          const fullName = [editedProfile.name, editedProfile.surname]
            .map((value) => value.trim())
            .filter(Boolean)
            .join(" ");

          if (fullName) {
            params.set("prefillName", fullName);
          }

          if (editedProfile.profession.trim()) {
            params.set("prefillIndustry", editedProfile.profession.trim());
          }

          if (editedProfile.location.trim()) {
            params.set("prefillLocation", editedProfile.location.trim());
          }

          router.push(`/profile/CompanyManagement?${params.toString()}`);
        }}
      />
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />

      {/* Custom Header */}
      <ThemedView style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Edit Profile</ThemedText>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <ThemedText style={[styles.saveButtonText, { color: tintColor }]}>
            {isSaving ? "Saving..." : "Save"}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
      <View style={{ flex: 1 }}>
        {businessUpgraded === "true" ? (
          <View
            style={[
              styles.businessBanner,
              {
                backgroundColor: backgroundSecondary,
                borderColor,
              },
            ]}
          >
            <View
              style={[
                styles.businessBannerIcon,
                { backgroundColor, borderColor },
              ]}
            >
              <Feather name="briefcase" size={16} color={textColor} />
            </View>
            <View style={styles.businessBannerContent}>
              <ThemedText style={styles.businessBannerTitle}>
                Business tools unlocked
              </ThemedText>
              <ThemedText style={styles.businessBannerText}>
                Your account is now ready for company management and job
                publishing.
              </ThemedText>
            </View>
          </View>
        ) : null}

        {/* Avatar */}
        <Pressable onPress={pickAvatar} style={styles.avatarPreview}>
          <ThemedAvatar
            image={
              (profile?.avatar_url as string) ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                editedProfile.name || "User"
              )}&size=80`
            }
            size={80}
          >
            <View
              style={[styles.avatarOverlay, { backgroundColor: tintColor }]}
            >
              <Feather name="camera" size={16} color={backgroundColor} />
            </View>
          </ThemedAvatar>
        </Pressable>
        {isUploadingAvatar ? (
          <ThemedText style={styles.avatarStatus}>Uploading photo...</ThemedText>
        ) : null}

        <SettingsList sections={settingsData} />

        {error && (
          <ThemedText style={{ color: "#ef4444", margin: 8 }}>
            {error}
          </ThemedText>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  saveButton: {
    padding: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  businessBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  businessBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  businessBannerContent: {
    flex: 1,
  },
  businessBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  businessBannerText: {
    fontSize: 13,
    lineHeight: 18,
  },

  avatarPreview: {
    alignSelf: "center",
    marginVertical: 24,
  },
  avatarStatus: {
    textAlign: "center",
    marginTop: -10,
    marginBottom: 18,
    fontSize: 13,
  },
  avatarOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderRadius: 16,
    padding: 6,
  },
});
