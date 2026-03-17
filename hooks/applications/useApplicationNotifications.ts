import { useCallback } from 'react';
import { useAuth } from '../auth';
import { supabase } from '@/utils/supabase';
import { sendNotification } from '@/utils/notifications';

export function useApplicationNotifications() {
    const { user, profile } = useAuth();

    // Send notification when application status changes
    const notifyApplicationStatusChange = useCallback(async (
        applicationId: string,
        applicantId: string,
        newStatus: string,
        postOwnerId?: string
    ) => {
        if (!user?.id) return;

        try {
            const { data: application } = await supabase
                .from('applications')
                .select('id, post_id, job_title_snapshot, application_snapshot, posts(id,title,user_id)')
                .eq('id', applicationId)
                .maybeSingle();

            const post = Array.isArray(application?.posts)
                ? application?.posts[0]
                : application?.posts;

            if (application && post) {
                const actorName = profile
                    ? [profile.name, profile.surname].filter(Boolean).join(' ').trim() || profile.username || 'Someone'
                    : 'Someone';
                const postTitle =
                    application.job_title_snapshot ||
                    application.application_snapshot?.job?.title ||
                    post.title;
                const title = `Application status updated`;
                const body = `Your application for "${postTitle}" is now ${newStatus}`;

                await sendNotification(
                    applicantId,
                    title,
                    body,
                    'application_status',
                    {
                        type: 'application_status',
                        applicationId,
                        postId: application.post_id ?? post.id,
                        newStatus,
                        postOwnerName: actorName,
                        jobTitle: postTitle,
                    }
                );
            }
        } catch (error) {
            console.error('Error sending application status notification:', error);
        }
    }, [profile, user?.id]);

    // Send notification when someone applies to your job
    const notifyNewApplication = useCallback(async (
        applicationId: string,
        postOwnerId: string,
        applicantName: string,
        jobTitle: string
    ) => {
        if (!user?.id || user.id === postOwnerId) return; // Don't notify yourself

        try {
            const title = `New application received`;
            const body = `${applicantName} applied to your job "${jobTitle}"`;

            await sendNotification(
                postOwnerId,
                title,
                body,
                'application_status',
                {
                    type: 'application_status',
                    applicationId,
                    applicantName,
                    jobTitle,
                }
            );
        } catch (error) {
            console.error('Error sending new application notification:', error);
        }
    }, [user?.id]);

    return {
        notifyApplicationStatusChange,
        notifyNewApplication,
    };
} 
