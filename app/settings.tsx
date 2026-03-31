import React from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useAppTheme, useAuth, useColorScheme, useThemeColor } from "@/hooks";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import ScreenContainer from "@/components/ScreenContainer";
import SettingsList from "@/components/ui/SettingsList";
import ActionPromptModal from "@/components/ui/ActionPromptModal";
import { useFlashToast } from "@/components/ui/Flash";
import SelectionPromptModal from "@/components/ui/SelectionPromptModal";

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  icon: string;
  onPress?: () => void;
  showArrow?: boolean;
  showSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  destructive?: boolean;
  iconColor?: string;
  // Text input props
  showTextInput?: boolean;
  textInputValue?: string;
  textInputPlaceholder?: string;
  onTextInputChange?: (text: string) => void;
  textInputProps?: any;
}

interface SettingsSection {
  title: string;
  data: SettingsItemProps[];
}

export default function Settings() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const colorScheme = useColorScheme() ?? "light";
  const { setThemePreference, themePreference } = useAppTheme();
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "border");
  const supportEmail = "support@growork.app";
  const toast = useFlashToast();
  const [showResetPrompt, setShowResetPrompt] = React.useState(false);
  const [showSignOutPrompt, setShowSignOutPrompt] = React.useState(false);
  const [showDeletePrompt, setShowDeletePrompt] = React.useState(false);
  const [showAppearancePrompt, setShowAppearancePrompt] = React.useState(false);

  const appearanceSubtitle =
    themePreference === "system"
      ? `Using device setting (${colorScheme === "dark" ? "Dark" : "Light"})`
      : themePreference === "dark"
      ? "Always dark"
      : "Always light";

  const openSupportEmail = async (subject: string) => {
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`;
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      toast.show({
        type: "info",
        title: "Support",
        message: `Please email us at ${supportEmail} and we will help you out.`,
      });
      return;
    }

    await Linking.openURL(url);
  };

  const sendPasswordReset = async () => {
    if (!user?.email) {
      toast.show({
        type: "danger",
        title: "Password reset",
        message: "We could not find your account email.",
      });
      return;
    }
    setShowResetPrompt(true);
  };

  const handleSignOut = () => {
    setShowSignOutPrompt(true);
  };

  const handleDeleteAccount = () => {
    setShowDeletePrompt(true);
  };

  const handleAppearance = () => {
    setShowAppearancePrompt(true);
  };

  const settingsData: SettingsSection[] = [
    {
      title: "Account",
      data: [
        {
          title: "Account Email",
          subtitle: user?.email || "No email found for this account",
          icon: "mail",
        },
        {
          title: "Edit Profile",
          subtitle: "Update your personal information",
          icon: "user",
          onPress: () => router.push("/profile/edit-profile"),
        },
        {
          title: "Change Password",
          subtitle: "Update your password",
          icon: "lock",
          onPress: sendPasswordReset,
        },
        {
          title: "Privacy",
          subtitle: "Manage your privacy settings",
          icon: "shield",
          onPress: () =>
            toast.show({
              type: "info",
              title: "Privacy",
              message:
                "Your profile and activity are currently limited to authenticated app experiences. Contact support if you need help with account privacy.",
            }),
        },
      ],
    },
    {
      title: "Documents & Media",
      data: [
        {
          title: "Manage Documents",
          subtitle: "CV, certificates, portfolio",
          icon: "folder",
          onPress: () => router.push("/profile/documents"),
        },
        {
          title: "Companies",
          subtitle: "Manage followed companies",
          icon: "briefcase",
          onPress: () => router.push("/profile/companies"),
        },
        {
          title: "Media Outlets",
          subtitle: "Podcasts, news, voice content",
          icon: "radio",
          onPress: () => router.push("/(tabs)/search"),
        },
      ],
    },
    {
      title: "Preferences",
      data: [
        {
          title: "Notifications",
          subtitle: "Manage notification preferences",
          icon: "bell",
          onPress: () => router.push("/notifications"),
        },
        {
          title: "Appearance",
          subtitle: appearanceSubtitle,
          icon: "moon",
          onPress: handleAppearance,
        },
        {
          title: "Language",
          subtitle: "English",
          icon: "globe",
          onPress: () =>
            toast.show({
              type: "info",
              title: "Language",
              message:
                "English is currently the supported language in this version of GROWORK.",
            }),
        },
      ],
    },
    {
      title: "Support",
      data: [
        {
          title: "Help Center",
          subtitle: "Get help and support",
          icon: "help-circle",
          onPress: () => openSupportEmail("GROWORK Help Request"),
        },
        {
          title: "Contact Us",
          subtitle: "Reach out to our team",
          icon: "mail",
          onPress: () => openSupportEmail("GROWORK Support"),
        },
        {
          title: "About",
          subtitle: "App version and information",
          icon: "info",
          onPress: () =>
            toast.show({
              type: "info",
              title: "About",
              message:
                "Growork v1.0.0\n\nA modern job search and networking platform.",
            }),
        },
      ],
    },
    {
      title: "Danger Zone",
      data: [
        {
          title: "Sign Out",
          subtitle: "Sign out of your account",
          icon: "log-out",
          onPress: handleSignOut,
          destructive: true,
        },
        {
          title: "Delete Account",
          subtitle: "Permanently delete your account",
          icon: "trash-2",
          onPress: handleDeleteAccount,
          destructive: true,
        },
      ],
    },
  ];

  return (
    <ScreenContainer>
      <ActionPromptModal
        visible={showResetPrompt}
        title="Reset password"
        message={`Send a password reset link to ${user?.email}?`}
        cancelLabel="Cancel"
        confirmLabel="Send link"
        onCancel={() => setShowResetPrompt(false)}
        onConfirm={async () => {
          setShowResetPrompt(false);
          try {
            const { supabase } = await import("@/utils/supabase");
            const { error } = await supabase.auth.resetPasswordForEmail(
              user?.email || ""
            );
            if (error) throw error;
            toast.show({
              type: "success",
              title: "Email sent",
              message: "We sent a password reset link to your email address.",
            });
          } catch (error: any) {
            toast.show({
              type: "danger",
              title: "Password reset",
              message:
                error?.message || "We could not send the reset email right now.",
            });
          }
        }}
      />
      <ActionPromptModal
        visible={showSignOutPrompt}
        title="Sign out"
        message="Are you sure you want to sign out?"
        cancelLabel="Cancel"
        confirmLabel="Sign out"
        onCancel={() => setShowSignOutPrompt(false)}
        onConfirm={async () => {
          setShowSignOutPrompt(false);
          await signOut();
          router.replace("/auth/login");
        }}
      />
      <ActionPromptModal
        visible={showDeletePrompt}
        title="Delete account"
        message="This action cannot be undone. All your data will be permanently deleted."
        cancelLabel="Cancel"
        confirmLabel="Continue"
        onCancel={() => setShowDeletePrompt(false)}
        onConfirm={() => {
          setShowDeletePrompt(false);
          void openSupportEmail("GROWORK Account Deletion Request");
        }}
      />
      <SelectionPromptModal
        visible={showAppearancePrompt}
        title="Appearance"
        message={`Current mode: ${appearanceSubtitle}`}
        options={[
          {
            label: "Use device settings",
            onPress: () => {
              setShowAppearancePrompt(false);
              void setThemePreference("system");
              toast.show({
                type: "success",
                title: "Appearance updated",
                message: "GROWORK is now following your device setting.",
              });
            },
          },
          {
            label: "Light",
            onPress: () => {
              setShowAppearancePrompt(false);
              void setThemePreference("light");
              toast.show({
                type: "success",
                title: "Appearance updated",
                message: "Light mode is now active.",
              });
            },
          },
          {
            label: "Dark",
            onPress: () => {
              setShowAppearancePrompt(false);
              void setThemePreference("dark");
              toast.show({
                type: "success",
                title: "Appearance updated",
                message: "Dark mode is now active.",
              });
            },
          },
        ]}
        onCancel={() => setShowAppearancePrompt(false)}
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
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>
        <View style={styles.headerSpacer} />
      </ThemedView>

      <SettingsList sections={settingsData} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 40,
  },
});
