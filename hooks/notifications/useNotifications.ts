import { useCallback, useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '../auth/useAuth';
import { Notification } from '@/types/notifications';

export interface NotificationConfig {
  type?: 'general' | 'interaction' | 'application';
  operations?: boolean;
  autoFetch?: boolean;
  limit?: number;
  realtime?: boolean;
}

export interface NotificationOperations {
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  sendNotification: (recipientId: string, type: string, data: any) => Promise<void>;
}

const NOTIFICATION_TYPE_GROUPS: Record<
  NonNullable<NotificationConfig["type"]>,
  string[]
> = {
  general: ['general', 'company_status', 'test'],
  interaction: ['interaction', 'post_like', 'post_comment', 'post_bookmark', 'comment_like'],
  application: ['application', 'application_status'],
};

// Unified hook for all notification types with optional operations
export function useNotifications(config: NotificationConfig = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  // Use refs to avoid circular dependencies
  const fetchNotificationsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const notificationsRef = useRef(notifications);

  // Update refs when values change
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
    notificationsRef.current = notifications;
  });

  // Fetch notifications based on config
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (config.type) {
        query = query.in('type', NOTIFICATION_TYPE_GROUPS[config.type]);
      }

      if (config.limit) {
        query = query.limit(config.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const notificationsData = data || [];
      setNotifications(notificationsData);
      setUnreadCount(notificationsData.filter(n => !n.read).length);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, config.type, config.limit]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
    }
  }, [user]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );

      // Reset unread count
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [user]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state using the ref to avoid dependency issues
      const deletedNotification = notificationsRef.current.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      // Update unread count if deleted notification was unread
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      console.error('Error deleting notification:', err);
    }
  }, [user]);

  // Send a notification to another user
  const sendNotification = useCallback(async (recipientId: string, type: string, data: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          type,
          data,
          sender_id: user.id,
          read: false
        });

      if (error) throw error;
    } catch (err: any) {
      console.error('Error sending notification:', err);
    }
  }, [user]);

  // Setup realtime subscription if enabled
  useEffect(() => {
    if (!config.realtime || !user) return;

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newNotification = payload.new as Notification;
        setNotifications(prev => {
          const next = [newNotification, ...prev];
          setUnreadCount(next.filter(n => !n.read).length);
          return next;
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const updatedNotification = payload.new as Notification;
        setNotifications(prev => {
          const next = prev.map(n =>
            n.id === updatedNotification.id ? updatedNotification : n
          );
          // Don't rely on payload.old (often not available without replica identity).
          setUnreadCount(next.filter(n => !n.read).length);
          return next;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, config.realtime]);

  // Auto-fetch notifications
  useEffect(() => {
    if (config.autoFetch !== false && user?.id) {
      fetchNotifications();
    }
  }, [config.autoFetch, user?.id, fetchNotifications]);

  // Return operations if requested
  if (config.operations) {
    return {
      notifications,
      loading,
      error,
      unreadCount,
      operations: {
        markAsRead,
        markAllAsRead,
        deleteNotification,
        sendNotification,
        refetch: fetchNotifications
      }
    };
  }

  // Return basic notification data
  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendNotification,
    refetch: fetchNotifications
  };
}

// Convenience hooks for specific notification types
export function useGeneralNotifications(config: Omit<NotificationConfig, 'type'> = {}) {
  return useNotifications({ ...config, type: 'general' });
}

export function useInteractionNotifications(config: Omit<NotificationConfig, 'type'> = {}) {
  return useNotifications({ ...config, type: 'interaction' });
}

export function useApplicationNotifications(config: Omit<NotificationConfig, 'type'> = {}) {
  return useNotifications({ ...config, type: 'application' });
}

// Hook with operations enabled
export function useNotificationOperations(config: Omit<NotificationConfig, 'operations'> = {}) {
  return useNotifications({ ...config, operations: true });
}