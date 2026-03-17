import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NotificationBadge from './NotificationBadge';
import { useThemeColor } from '@/hooks';

interface NotificationIconProps {
    size?: number;
    onPress?: () => void;
}

export function NotificationIcon({ size = 24, onPress }: NotificationIconProps) {
    const router = useRouter();
    const iconColor = useThemeColor({}, 'icon');

    const handlePress = () => {
        if (onPress) {
            onPress();
            return;
        }
        router.push('/notifications');
    };

    return (
        <TouchableOpacity
            accessibilityRole="button"
            onPress={handlePress}
            style={styles.container}
            activeOpacity={0.7}
        >
            <Feather name="bell" size={size} color={iconColor} />
            <NotificationBadge />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
}); 