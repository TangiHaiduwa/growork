import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { Application } from '@/types';
import { useAuth } from '@/hooks/auth';

export interface ApplicationStatusConfig {
  postIds?: string[];
  single?: boolean;
  autoFetch?: boolean;
}

// Unified hook for application statuses
export function useApplicationStatus(config: ApplicationStatusConfig = {}) {
  const [statuses, setStatuses] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const normalizedPostIds = useMemo(
    () => (config.postIds || []).filter(Boolean),
    [config.postIds]
  );
  const postIdsKey = useMemo(() => normalizedPostIds.join('|'), [normalizedPostIds]);

  const fetchStatuses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.id) {
        setStatuses([]);
        return;
      }

      if (config.single && normalizedPostIds.length === 1) {
        // Single application status for current user
        const { data, error: fetchError } = await supabase
          .from('applications')
          .select('*, applicant_name_snapshot, applicant_phone_snapshot, job_title_snapshot, cv_document_id_snapshot, application_snapshot')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        const matchingApplication =
          (data || []).find(
            (application: any) =>
              application.post_id === normalizedPostIds[0]
          ) || null;
        setStatuses(matchingApplication ? [matchingApplication] : []);
      } else if (normalizedPostIds.length > 0) {
        // Multiple application statuses for current user
        const { data, error: fetchError } = await supabase
          .from('applications')
          .select('*, applicant_name_snapshot, applicant_phone_snapshot, job_title_snapshot, cv_document_id_snapshot, application_snapshot')
          .eq('user_id', user.id);

        if (fetchError) throw fetchError;
        const filteredStatuses = (data || []).filter(
          (application: any) =>
            normalizedPostIds.includes(application.post_id)
        );
        setStatuses(filteredStatuses);
      } else {
        // All application statuses for current user
        const { data, error: fetchError } = await supabase
          .from('applications')
          .select('*, applicant_name_snapshot, applicant_phone_snapshot, job_title_snapshot, cv_document_id_snapshot, application_snapshot')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setStatuses(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching application statuses:', err);
      setError(err.message);
      setStatuses([]); // Ensure statuses is empty on error
    } finally {
      setLoading(false);
    }
  }, [config.single, normalizedPostIds, postIdsKey, user?.id]);

  useEffect(() => {
    if (config.autoFetch !== false) {
      fetchStatuses();
    }
  }, [config.autoFetch, fetchStatuses]);

  const refresh = useCallback(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  return {
    statuses,
    loading,
    error,
    refresh
  };
}

// Specialized variants for backward compatibility
export function useApplicationStatusSingle(postId: string) {
  return useApplicationStatus({
    postIds: [postId],
    single: true,
    autoFetch: true
  });
}

export function useApplicationStatuses(postIds?: string[]) {
  return useApplicationStatus({
    postIds,
    single: false,
    autoFetch: true
  });
} 
