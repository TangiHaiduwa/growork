import { Application, ApplicationStatus } from '@/types';
import { supabase } from '@/utils/supabase';
import { supabaseRequest } from '@/utils/supabaseRequest';
import { useCallback, useEffect, useState } from 'react';
import { sendApplicationStatusNotification } from '@/utils/notifications';

const resolveApplicantId = (application: any) => application.user_id;

const resolvePostId = (application: any) => application.post_id;

export function useApplications(userId?: string) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrateApplications = useCallback(async (rawApplications: any[]) => {
    const postIds = Array.from(
      new Set(rawApplications.map((application) => resolvePostId(application)).filter(Boolean))
    );
    const applicantIds = Array.from(
      new Set(
        rawApplications
          .map((application) => resolveApplicantId(application))
          .filter(Boolean)
      )
    );

    const [postsResult, profilesResult] = await Promise.all([
      postIds.length
        ? supabaseRequest<any[]>(
            async () => {
              const { data, error, status } = await supabase
                .from('posts')
                .select('id, title, type, industry, criteria')
                .in('id', postIds);
              return { data, error, status };
            },
            { logTag: 'applications:hydrate:posts' }
          )
        : Promise.resolve({ data: [] as any[] }),
      applicantIds.length
        ? supabaseRequest<any[]>(
            async () => {
              const { data, error, status } = await supabase
                .from('legacy_public_profiles')
                .select('id, username, full_name, avatar_url, bio, name, surname')
                .in('id', applicantIds);
              return { data, error, status };
            },
            { logTag: 'applications:hydrate:profiles' }
          )
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const postsById = (postsResult.data || []).reduce((acc: Record<string, any>, post: any) => {
      acc[post.id] = post;
      return acc;
    }, {});

    const profilesById = (profilesResult.data || []).reduce((acc: Record<string, any>, profile: any) => {
      acc[profile.id] = profile;
      return acc;
    }, {});

    return rawApplications.map((application: any) => {
      const applicantId = resolveApplicantId(application);
      const postId = resolvePostId(application);
      const liveProfile = profilesById[applicantId] || null;
      const snapshotApplicant = application.application_snapshot?.applicant || null;
      const snapshotName =
        application.applicant_name_snapshot ||
        snapshotApplicant?.full_name ||
        null;
      const [firstName, ...surnameParts] = snapshotName
        ? String(snapshotName).trim().split(/\s+/)
        : [];

      return {
        ...application,
        posts: postsById[postId] || null,
        profiles:
          liveProfile ||
          {
            id: applicantId,
            username: null,
            full_name: snapshotName,
            avatar_url: null,
            bio: null,
            name: firstName || null,
            surname: surnameParts.length ? surnameParts.join(' ') : null,
            phone:
              application.applicant_phone_snapshot ||
              snapshotApplicant?.phone ||
              null,
          },
      };
    });
  }, []);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await supabaseRequest<any[]>(
        async () => {
          let query = supabase
            .from('applications')
            .select('*, applicant_name_snapshot, applicant_phone_snapshot, job_title_snapshot, cv_document_id_snapshot, application_snapshot')
            .order('created_at', { ascending: false });
          if (userId) {
            query = query.eq('user_id', userId);
          }
          const { data, error, status } = await query;
          return { data, error, status };
        },
        { logTag: 'applications:list' }
      );

      setApplications(await hydrateApplications(data || []));
    } catch (err: any) {
      console.error('Error fetching applications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [hydrateApplications, userId]);

  const fetchApplicationsForMyPosts = useCallback(async (currentUserId: string) => {
    try {
      setLoading(true);
      setError(null);

      const [{ data: companiesData }, { data: myPosts }] = await Promise.all([
        supabaseRequest<{ id: string }[]>(
          async () => {
            const { data, error, status } = await supabase
              .from('companies')
              .select('id')
              .or(`user_id.eq.${currentUserId},owner_id.eq.${currentUserId}`);
            return { data, error, status };
          },
          { logTag: 'posts:mine:companiesForUser' }
        ),
        supabaseRequest<{ id: string }[]>(
          async () => {
            const { data, error, status } = await supabase
              .from('posts')
              .select('id')
              .eq('user_id', currentUserId);
            return { data, error, status };
          },
          { logTag: 'posts:mine' }
        ),
      ]);

      const companyIds = (companiesData || []).map((c) => c.id).filter(Boolean);

      const { data: companyPosts } = companyIds.length
        ? await supabaseRequest<{ id: string }[]>(
            async () => {
              const orFilters = [
                `criteria->>companyId.in.(${companyIds.join(',')})`,
                `criteria->>company_id.in.(${companyIds.join(',')})`,
              ];
              const { data, error, status } = await supabase
                .from('posts')
                .select('id')
                .or(orFilters.join(','));
              return { data, error, status };
            },
            { logTag: 'posts:mine:companyPosts' }
          )
        : { data: [] as { id: string }[] };

      const postIds = Array.from(
        new Set([...(myPosts || []), ...(companyPosts || [])].map((post) => post.id).filter(Boolean))
      );

      if (!postIds.length) {
        setApplications([]);
        return;
      }

      const { data: applicationsData } = await supabaseRequest<any[]>(
        async () => {
          const { data, error, status } = await supabase
            .from('applications')
            .select(`
              *,
              posts (
                id,
                title,
                type,
                industry,
                criteria
              )
            `)
            .in('post_id', postIds)
            .order('created_at', { ascending: false });
          return { data, error, status };
        },
        { logTag: 'applications:byPosts' }
      );

      const applicantIds = Array.from(
        new Set((applicationsData || []).map((app: any) => app.user_id).filter(Boolean))
      );

      let profilesById: Record<string, any> = {};
      if (applicantIds.length) {
        const { data: profilesData } = await supabaseRequest<any[]>(
          async () => {
            const { data, error, status } = await supabase
              .from('legacy_public_profiles')
              .select('id, username, full_name, avatar_url, bio, name, surname')
              .in('id', applicantIds);
            return { data, error, status };
          },
          { logTag: 'profiles:listForApplicationsByPosts' }
        );

        for (const profile of profilesData || []) {
          if (profile?.id) profilesById[profile.id] = profile;
        }
      }

      const hydratedApplications = (applicationsData || []).map((application: any) => {
        const applicantId = resolveApplicantId(application);
        const liveProfile = profilesById[applicantId] || null;
        const snapshotApplicant = application.application_snapshot?.applicant || null;
        const snapshotFullName =
          application.applicant_name_snapshot ||
          snapshotApplicant?.full_name ||
          null;
        const [snapshotName, ...snapshotSurnameParts] = snapshotFullName
          ? String(snapshotFullName).trim().split(/\s+/)
          : [];

        return {
          ...application,
          profiles:
            liveProfile ||
            {
              id: applicantId,
              username: null,
              name: snapshotName || null,
              surname: snapshotSurnameParts.length
                ? snapshotSurnameParts.join(' ')
                : null,
              full_name: snapshotFullName,
              avatar_url: null,
              bio: null,
              phone:
                application.applicant_phone_snapshot ||
                snapshotApplicant?.phone ||
                null,
            },
        };
      });

      setApplications(hydratedApplications);
    } catch (err: any) {
      console.error('Error fetching applications for my posts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchApplications();
    }
  }, [userId, fetchApplications]);

  const addApplication = useCallback(async (applicationData: Partial<Application>) => {
    try {
      setLoading(true);
      const { data } = await supabaseRequest<Application[]>(
        async () => {
          const { data, error, status } = await supabase
            .from('applications')
            .insert([applicationData])
            .select();
          return { data, error, status };
        },
        { logTag: 'applications:create' }
      );

      await fetchApplications();
      return { data, error: null };
    } catch (err: any) {
      console.error('Error adding application:', err);
      setError(err.message);
      return { data: null, error: err };
    } finally {
      setLoading(false);
    }
  }, [fetchApplications]);

  const withdrawApplication = useCallback(async (applicationId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: deletedRows } = await supabaseRequest<{ id: string }[]>(
        async () => {
          let query = supabase
            .from('applications')
            .delete()
            .eq('id', applicationId)
            .select('id');

          if (userId) {
            query = query.eq('user_id', userId);
          }

          const { data, error, status } = await query;
          return { data, error, status };
        },
        { logTag: 'applications:withdraw' }
      );

      if (!deletedRows?.length) {
        throw new Error('This application could not be withdrawn.');
      }

      setApplications((prev) =>
        prev.filter((application: any) => application.id !== applicationId)
      );

      if (userId) {
        await fetchApplications();
      }

      return { error: null };
    } catch (err: any) {
      console.error('Error withdrawing application:', err);
      setError(err.message);
      return { error: err };
    } finally {
      setLoading(false);
    }
  }, [fetchApplications, userId]);

  const updateApplicationStatus = useCallback(async (applicationId: string, status: ApplicationStatus) => {
    try {
      const { data: applicationData } = await supabaseRequest<any>(
        async () => {
          const { data, error, status: httpStatus } = await supabase
            .from('applications')
            .select('*')
            .eq('id', applicationId)
            .single();
          return { data, error, status: httpStatus };
        },
        { logTag: 'applications:get' }
      );

      let postData = null;
      let profileData = null;

      if (applicationData) {
        try {
          const { data: post } = await supabaseRequest<any>(
            async () => {
              const { data, error, status: httpStatus } = await supabase
                .from('posts')
                .select('id, title')
                .eq('id', resolvePostId(applicationData))
                .single();
              return { data, error, status: httpStatus };
            },
            { logTag: 'posts:get' }
          );
          if (post) postData = post;

          const { data: profile } = await supabaseRequest<any>(
            async () => {
              const { data, error, status: httpStatus } = await supabase
                .from('legacy_public_profiles')
                .select('id, username, name, surname')
                .eq('id', resolveApplicantId(applicationData))
                .single();
              return { data, error, status: httpStatus };
            },
            { logTag: 'profiles:get' }
          );
          if (profile) profileData = profile;
        } catch (err) {
          console.warn('Error fetching related data:', err);
        }
      }

      await supabaseRequest<null>(
        async () => {
          const { data, error, status: httpStatus } = await supabase
            .from('applications')
            .update({ status })
            .eq('id', applicationId);
          return { data: null, error, status: httpStatus };
        },
        { logTag: 'applications:updateStatus' }
      );

      if (applicationData) {
        const jobTitle =
          applicationData.job_title_snapshot ||
          postData?.title ||
          'a job';
        await sendApplicationStatusNotification(
          resolveApplicantId(applicationData),
          status,
          jobTitle
        );
      }

      await fetchApplications();
      return { error: null };
    } catch (err: any) {
      console.error('Error updating application status:', err);
      return { error: err };
    }
  }, [fetchApplications]);

  const checkIfApplied = useCallback(async (userId: string, postId: string) => {
    try {
      const { data } = await supabaseRequest<{ id: string; post_id?: string | null }[]>(
        async () => {
          const { data, error, status } = await supabase
            .from('applications')
            .select('id, post_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          return { data, error, status };
        },
        { logTag: 'applications:check' }
      );

      const hasApplied = (data || []).some(
        (application) => application.post_id === postId
      );

      return { hasApplied, error: null };
    } catch (err: any) {
      console.error('Error checking if applied:', err);
      return { hasApplied: false, error: err };
    }
  }, []);

  return {
    applications,
    loading,
    error,
    fetchApplications,
    fetchApplicationsForMyPosts,
    addApplication,
    withdrawApplication,
    updateApplicationStatus,
    checkIfApplied,
  };
}
