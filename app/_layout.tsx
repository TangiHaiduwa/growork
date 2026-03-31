import FlashBar from "@/components/ui/Flash";
import { AppProvider } from "@/utils/AppContext";
import { NotificationProvider } from "@/components/NotificationProvider";
import { Colors } from "@/constants/Colors";
import { supabase, handleAuthError } from "@/utils/supabase";
import { setOpenGlobalSheet } from "@/utils/globalSheet";
import { AuthErrorHandler } from "@/components/AuthErrorHandler";
import { ThemePreferenceProvider } from "@/utils/theme";

import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import {
  BottomSheetModalProvider,
  BottomSheetModal,
} from "@gorhom/bottom-sheet";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Session } from "@supabase/supabase-js";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import React, {
  useEffect,
  useState,
  createContext,
  useContext,
  useMemo,
  useRef,
} from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { enableScreens } from "react-native-screens";
import "@react-native-masked-view/masked-view";
import SimpleBottomSheet from "@/components/GlobalBottomSheet";
import { CommentsBottomSheetWithContext } from "@/components/content/comments/CommentsBottomSheet";
import { InteractionManager, Linking } from "react-native";
import { CommentsBottomSheetProvider } from "@/hooks/ui/useBottomSheet";
import { useColorScheme } from "@/hooks";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "@/components/ErrorBoundary";

enableScreens(false);

interface AuthContextType {
  session: Session | null;
  initialLoading: boolean;
}
export const AuthContext = createContext<AuthContextType>({
  session: null,
  initialLoading: true,
});
export function useAuth() {
  return useContext(AuthContext);
}

function useProtectedRoute() {
  const { session, initialLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (initialLoading) return;
    const isAuthRoute = segments.some((segment) => segment === "auth");
    const isRootIndex = typeof segments[0] === "undefined";
    const isAuthSuccessRoute =
      segments.some((segment) => segment === "auth") &&
      segments.some((segment) => segment === "success");
    const isAuthResetPasswordRoute =
      segments.some((segment) => segment === "auth") &&
      segments.some((segment) => segment === "reset-password");

    if (!session?.user && !isAuthRoute && !isRootIndex) {
      router.replace("/auth/login");
      return;
    }

    if (
      session?.user &&
      isAuthRoute &&
      !isAuthSuccessRoute &&
      !isAuthResetPasswordRoute
    ) {
      router.replace("/(tabs)");
    }
  }, [session, initialLoading, router, segments]);
}

function extractSupabaseAuthParams(url: string) {
  const fragment = url.split("#")[1] ?? "";
  const query = url.includes("?") ? url.split("?")[1]?.split("#")[0] ?? "" : "";
  const merged = [query, fragment].filter(Boolean).join("&");
  const params = new URLSearchParams(merged);

  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
  };
}

function AuthGate() {
  const { session, initialLoading } = useAuth();
  useProtectedRoute();

  if (initialLoading) {
    return null;
  }

  if (!session?.user) {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "none",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="+not-found" />
      </Stack>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="post" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function AppContent() {
  const colorScheme = useColorScheme() ?? "light";
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const themeColors = Colors[colorScheme];
  const navigationTheme = useMemo(
    () => ({
      ...(colorScheme === "dark" ? DarkTheme : DefaultTheme),
      colors: {
        ...(colorScheme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
        primary: themeColors.tint,
        background: themeColors.background,
        card: themeColors.background,
        text: themeColors.text,
        border: themeColors.border,
        notification: themeColors.tint,
      },
    }),
    [colorScheme, themeColors]
  );

  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [startupUiReady, setStartupUiReady] = useState(false);

  const clearAuthError = () => {
    setAuthError(null);
  };

  // Keep the splash screen visible while we fetch resources
  useEffect(() => {
    const preventAutoHide = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch (error) {
        console.error("Error preventing auto hide:", error);
      }
    };
    preventAutoHide();
  }, []);

  // Initialize gesture handler
  useEffect(() => {
    // This ensures gesture handler is properly initialized
    const initGestureHandler = () => {
      // Gesture handler initialization is handled by the GestureHandlerRootView
    };
    initGestureHandler();
  }, []);

  const sheetRef = useRef<BottomSheetModal>(null);
  const [sheetProps, setSheetProps] = useState<{
    children: React.ReactNode;
    snapPoints?: string[];
    onDismiss?: () => void;
    dynamicSnapPoint?: boolean;
    dynamicOptions?: {
      minHeight?: number;
      maxHeight?: number;
      padding?: number;
    };
  } | null>(null);

  // Expose openGlobalSheet globally
  const openGlobalSheet = (props: {
    children: React.ReactNode;
    snapPoints?: string[];
    onDismiss?: () => void;
    dynamicSnapPoint?: boolean;
    dynamicOptions?: {
      minHeight?: number;
      maxHeight?: number;
      padding?: number;
    };
  }) => {
    setSheetProps(props);

    // Check if we have snap points or dynamic snap point is enabled
    if (
      (props.snapPoints && props.snapPoints.length > 0) ||
      props.dynamicSnapPoint
    ) {
      // Use a more robust approach to ensure the sheet is presented
      const presentSheet = () => {
        if (sheetRef.current) {
          try {
            sheetRef.current.present();
          } catch (error) {
            console.error("Error presenting bottom sheet:", error);
          }
        } else {
          console.error("Bottom sheet ref is null, retrying...");
          // Retry after a short delay
          setTimeout(presentSheet, 50);
        }
      };

      // Initial attempt
      setTimeout(presentSheet, 100);
    } else {
      console.warn(
        "Cannot open bottom sheet: snapPoints array is empty and dynamicSnapPoint is not enabled"
      );
    }
  };

  useEffect(() => {
    // Ensure the global sheet is set after component is mounted
    const timer = setTimeout(() => {
      setOpenGlobalSheet(openGlobalSheet);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const getInitialSession = async () => {
      try {
        // Add safety check for environment variables
        if (
          !process.env.EXPO_PUBLIC_SUPABASE_URL ||
          !process.env.EXPO_PUBLIC_SUPABASE_KEY
        ) {
          console.error("Missing Supabase environment variables");
          if (isMounted) {
            setAuthError("App configuration error. Please contact support.");
            setInitialLoading(false);
          }
          return;
        }

        const {
          data: { session: currentSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        // Handle session error
        if (sessionError) {
          const { shouldSignOut, userMessage } = await handleAuthError(
            sessionError
          );
          console.error("Session error:", userMessage);
          if (shouldSignOut) {
            if (isMounted) {
              setSession(null);
              setAuthError(userMessage);
            }
          }
          return;
        }

        if (currentSession) {
          if (isMounted) setSession(currentSession);
        } else {
          if (isMounted) setSession(null);
        }
      } catch (error) {
        // Handle unexpected errors
        const { shouldSignOut, userMessage } = await handleAuthError(error);
        console.error("Unexpected auth error:", userMessage);
        if (shouldSignOut) {
          if (isMounted) {
            setSession(null);
            setAuthError(userMessage);
          }
        }
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      // Handle specific auth events
      if (event === "TOKEN_REFRESHED") {
        if (isMounted) clearAuthError();
      } else if (event === "SIGNED_OUT") {
        if (isMounted) {
          setSession(null);
          clearAuthError();
        }
      } else if (event === "SIGNED_IN") {
        if (isMounted) {
          setSession(currentSession);
          clearAuthError();
        }
      }

      // Update session state
      if (isMounted) setSession(currentSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const handleAuthDeepLink = async (url: string | null) => {
      if (!url || !isMounted) {
        return;
      }

      const { accessToken, refreshToken, type } = extractSupabaseAuthParams(url);

      if (type !== "recovery") {
        return;
      }

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("Failed to establish recovery session from deep link:", error);
          setAuthError("We could not open your password reset link. Please request a new one.");
          return;
        }

        if (isMounted && data.session) {
          setSession(data.session);
        }
      }

      if (isMounted) {
        router.replace("/auth/reset-password");
      }
    };

    Linking.getInitialURL()
      .then(handleAuthDeepLink)
      .catch((error) => {
        console.error("Error reading initial URL:", error);
      });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthDeepLink(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [router]);

  // Hide splash screen once everything is ready
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const hideSplashScreen = async () => {
      if (loaded && !initialLoading) {
        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.error("Error hiding splash screen:", error);
        }
      } else {
        // Set a timeout to hide splash screen after 3 seconds if loading takes too long
        timeout = setTimeout(async () => {
          try {
            await SplashScreen.hideAsync();
          } catch (error) {
            console.error("Error hiding splash screen:", error);
          }
        }, 3000);
      }
    };

    hideSplashScreen();

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [loaded, initialLoading]);

  useEffect(() => {
    if (!loaded || initialLoading) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      setStartupUiReady(true);
    });

    const fallbackTimer = setTimeout(() => {
      setStartupUiReady(true);
    }, 1200);

    return () => {
      task.cancel();
      clearTimeout(fallbackTimer);
    };
  }, [loaded, initialLoading]);

  if (!loaded || initialLoading) {
    return null; // Return null to keep splash screen visible
  }

  // Show auth error handler if there's an auth error
  if (authError) {
    return (
      <AuthErrorHandler
        error={authError}
        onRetry={clearAuthError}
        onSignIn={clearAuthError}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ActionSheetProvider>
          <ThemeProvider
            value={navigationTheme}
          >
            <AuthContext.Provider value={{ session, initialLoading }}>
              <AppProvider>
                <NotificationProvider>
                  <BottomSheetModalProvider>
                    <AuthGate />
                    <StatusBar
                      style={colorScheme === "dark" ? "light" : "dark"}
                    />
                    {startupUiReady ? <FlashBar /> : null}

                    {startupUiReady && sheetProps && (
                      <SimpleBottomSheet
                        ref={sheetRef}
                        snapPoints={sheetProps.snapPoints}
                        onDismiss={() => setSheetProps(null)}
                        dynamicSnapPoint={sheetProps.dynamicSnapPoint}
                        dynamicOptions={sheetProps.dynamicOptions}
                      >
                        {sheetProps.children}
                      </SimpleBottomSheet>
                    )}
                    {startupUiReady ? <CommentsBottomSheetWithContext /> : null}
                  </BottomSheetModalProvider>
                </NotificationProvider>
              </AppProvider>
            </AuthContext.Provider>
          </ThemeProvider>
        </ActionSheetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemePreferenceProvider>
        <CommentsBottomSheetProvider>
          <AppContent />
        </CommentsBottomSheetProvider>
      </ThemePreferenceProvider>
    </ErrorBoundary>
  );
}
