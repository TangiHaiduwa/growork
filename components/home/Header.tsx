import CategorySelector from "@/components/ui/CategorySelector";
import { Colors } from "@/constants/Colors";
import { INDUSTRIES } from "@/dataset/industries";
import { useColorScheme } from "@/hooks";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  Image,
} from "react-native";
import { ThemedText } from "../ThemedText";
import CustomOptionStrip from "@/components/ui/CustomOptionStrip";
import NotificationBadge from "@/components/ui/NotificationBadge";

interface HeaderProps {
  selectedContentType: number;
  onContentTypeChange: (index: number) => void;
  selectedIndustry: number;
  onIndustryChange: (index: number) => void;
  onAddPost: () => void;
}

const Header = ({
  selectedContentType,
  onContentTypeChange,
  selectedIndustry,
  onIndustryChange,
  onAddPost,
}: HeaderProps) => {
  const visibleIndustries = INDUSTRIES;
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const router = useRouter();

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          backgroundColor: theme.background,
        },
      ]}
    >
      <View style={styles.topRow}>
        <Image
          source={require("@/assets/logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            style={styles.iconButton}
            onPress={onAddPost}
            hitSlop={8}
          >
            <Feather name="plus" size={22} color={theme.icon} />
          </Pressable>
          <View style={styles.notificationContainer}>
            <Pressable
              style={styles.iconButton}
              onPress={() => router.push("/notifications")}
              hitSlop={12}
            >
              <Feather name="bell" size={22} color={theme.icon} />
              <NotificationBadge />
            </Pressable>
          </View>
        </View>
      </View>
      <CategorySelector
        options={["All", "Jobs", "News"]}
        selectedIndex={selectedContentType}
        onChange={onContentTypeChange}
        swipeEnabled
      />
      <CustomOptionStrip
        visibleOptions={visibleIndustries}
        selectedIndex={selectedIndustry}
        onChange={onIndustryChange}
        allOptions={INDUSTRIES}
        minVisibleOptions={1}
        maxVisibleOptions={6}
        style={styles.industrySelector}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  logoImage: {
    width: 100,
    height: 28,
  },
  notificationContainer: {
    position: "relative",
    marginLeft: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 4,
  },
  // Removed bellContainer as it's no longer needed
  header: {
    paddingTop: 10,
    paddingBottom: 8,
    justifyContent: "center",
  },
  industrySelector: {
    marginTop: 8,
    marginBottom: 0,
  },
});

const HEADER_HEIGHT = 200;

export { HEADER_HEIGHT };
export default Header;
