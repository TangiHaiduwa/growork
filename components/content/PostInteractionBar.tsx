import React, { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Platform, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeColor, useCustomCommentsBottomSheet } from '@/hooks';
import { useInteractions } from '@/hooks/posts/useInteractions';
import { ThemedText } from '@/components/ThemedText';


interface PostInteractionBarProps {
  postId: string;
  postOwnerId?: string;
  variant?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  containerStyle?: any;
}

export default function PostInteractionBar({
  postId,
  postOwnerId,
  variant = 'horizontal',
  size = 'medium', // ignored for icon size, always 20
  containerStyle,
}: PostInteractionBarProps) {
  const { 
    toggleLike, 
    toggleBookmark, 
    likeStates, 
    bookmarkStates, 
    initializePost 
  } = useInteractions();
  const { openCommentsSheet } = useCustomCommentsBottomSheet();

  // UI state - now directly synced with global state
  const [commentCount, setCommentCount] = useState(0);

  // Theme
  const iconColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');

  const iconSize = 20;

  useEffect(() => {
    if (postId) {
      // Initialize post state if not already done
      initializePost(postId);
    }
  }, [postId, initializePost]);

  // Get current states directly from global state
  const liked = likeStates[postId]?.isLiked || false;
  const likeCount = likeStates[postId]?.likeCount || 0;
  const bookmarked = bookmarkStates[postId]?.isBookmarked || false;

  // Handle like action
  const handleLike = async () => {
    if (!postId) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await toggleLike(postId);
    } catch (error) {
      console.error('Like toggle error:', error);
    }
  };

  // Handle bookmark action
  const handleBookmark = async () => {
    if (!postId) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await toggleBookmark(postId);
    } catch (error) {
      console.error('Bookmark toggle error:', error);
    }
  };

  // Handle comment action
  const handleComment = () => {
    if (postId) {
      if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openCommentsSheet(postId, postOwnerId);
    }
  };

  // Handle share action
  const handleShare = () => {
    if (postId) {
      if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Share.share({
        message: `Check out this post on GROWORK: https://growork.app/post/${postId}`,
        url: `https://growork.app/post/${postId}`,
        title: 'Share Post',
      }).catch((error) => {
        console.error('Share post error:', error);
      });
    }
  };

  return (
    <View
      style={[
        variant === 'horizontal' ? styles.horizontalContainer : styles.verticalContainer,
        containerStyle,
      ]}
    >
      <TouchableOpacity
        style={styles.iconButton}
        onPress={handleLike}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.likeContainer}>
          <Feather 
            name={liked ? "heart" : "heart"} 
            size={iconSize} 
            color={liked ? '#f43f5e' : iconColor}
            fill={liked ? '#f43f5e' : 'transparent'}
          />
          {likeCount > 0 && (
            <ThemedText style={[styles.likeCount, { color: iconColor }]}>
              {likeCount}
            </ThemedText>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={handleComment}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.iconContainer}>
          <Feather name="message-circle" size={iconSize} color={iconColor} />
          {commentCount > 0 && (
            <ThemedText style={[styles.countText, { color: iconColor }]}>
              {commentCount}
            </ThemedText>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={handleShare}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="share" size={iconSize} color={iconColor} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.iconButton,
          bookmarked ? { backgroundColor: `${tintColor}22` } : null,
        ]}
        onPress={handleBookmark}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather
          name="bookmark"
          size={iconSize}
          color={bookmarked ? tintColor : iconColor}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verticalContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 6,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 2,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 2,
  },
});
