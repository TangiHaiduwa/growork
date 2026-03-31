import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PostType } from '@/types';
import { ArticleFieldsData } from './ArticleFields';
import { JobFieldsData } from './JobFields';
import { useAuth } from '@/hooks';
import { usePostOperations } from '@/hooks/posts/usePostOperations';
import { Flash } from '@/components/ui/Flash';
import { Post } from '@/types/posts';

export function usePostForm(onSuccess?: () => void, initialPost?: Post | null) {
  const { user } = useAuth();
  const { addPost, updatePost } = usePostOperations();

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [postType, setPostType] = useState<PostType>(PostType.News);

  // Job-specific fields
  const [jobFields, setJobFields] = useState<JobFieldsData>({
    location: '',
    salary: '',
    jobType: '',
    industry: '',
    deadline: '',
    company: '',
    companyId: undefined,
    companyLogo: undefined,
  });

  // Article-specific fields
  const [articleFields, setArticleFields] = useState<ArticleFieldsData>({
    source: '',
    industry: '',
    company: '',
    companyId: undefined,
    companyLogo: undefined,
  });

  const hydrateFromPost = (post: Post) => {
    setTitle(post.title || '');
    setContent(post.content || '');
    setImageUrl(post.image_url || null);
    setPostType(post.type);

    if (post.type === PostType.Job) {
      setJobFields({
        location: post.criteria?.location || '',
        salary: post.criteria?.salary || '',
        jobType: post.criteria?.jobType || '',
        industry: post.industry || '',
        deadline: post.criteria?.deadline || '',
        company: post.criteria?.company || post.company_name || '',
        companyId: post.criteria?.companyId || post.criteria?.company_id || undefined,
        companyLogo: post.criteria?.companyLogo || post.company_logo || undefined,
      });
    } else {
      setArticleFields({
        source: post.criteria?.source || '',
        industry: post.industry || '',
        company: post.criteria?.company || post.company_name || '',
        companyId: post.criteria?.companyId || post.criteria?.company_id || undefined,
        companyLogo: post.criteria?.companyLogo || post.company_logo || undefined,
      });
    }
  };

  useEffect(() => {
    if (!initialPost) {
      return;
    }

    hydrateFromPost(initialPost);
  }, [initialPost]);

  const handleImageSelected = (imageUrl: string | null) => {
    setImageUrl(imageUrl);
  };

  const clearForm = () => {
    setTitle('');
    setContent('');
    setImageUrl(null);
    setPostType(PostType.News);
    setJobFields({
      location: '',
      salary: '',
      jobType: '',
      industry: '',
      deadline: '',
      company: '',
      companyId: undefined,
      companyLogo: undefined,
    });
    setArticleFields({
      source: '',
      industry: '',
      company: '',
      companyId: undefined,
      companyLogo: undefined,
    });
  };

  const handlePostTypeChange = (type: PostType) => {
    setPostType(type);
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Clear form when changing post type
    setTitle('');
    setContent('');
    setImageUrl(null);
  };

  const isFormValid = () => {
    return title.trim().length > 0 && content.trim().length > 0;
  };

  const handleSubmit = async () => {
    if (!user) {
      Flash.show({
        type: "danger",
        message: "Auth",
        description: "You must be logged in.",
      });
      return;
    }
    if (!isFormValid()) {
      Flash.show({
        type: "danger",
        message: "Validation",
        description: "Title and content are required.",
      });
      return;
    }
    const selectedCompanyId =
      postType === PostType.Job ? jobFields.companyId : articleFields.companyId;
    const selectedCompanyName =
      postType === PostType.Job ? jobFields.company : articleFields.company;

    if (!selectedCompanyId || !selectedCompanyName.trim()) {
      Flash.show({
        type: "danger",
        message: "Company required",
        description: "Select the company this post should be published under.",
      });
      return;
    }

    if (postType === PostType.Job && !jobFields.deadline) {
      Flash.show({
        type: "danger",
        message: "End date required",
        description: "Choose when this job listing should expire.",
      });
      return;
    }

    const baseCriteria = initialPost?.criteria || {};
    let criteria = { ...baseCriteria };
    let industry = null;

    if (postType === PostType.Job) {
      criteria = {
        ...baseCriteria,
        company: jobFields.company,
        companyId: jobFields.companyId, // Use company data from jobFields
        companyLogo: jobFields.companyLogo,
        location: jobFields.location,
        salary: jobFields.salary,
        jobType: jobFields.jobType,
        deadline: jobFields.deadline,
      };
      industry = jobFields.industry;
    } else if (postType === PostType.News) {
      criteria = {
        ...baseCriteria,
        company: articleFields.company,
        companyId: articleFields.companyId, // Use company data from articleFields
        companyLogo: articleFields.companyLogo,
        source: articleFields.source,
      };
      industry = articleFields.industry;
    }

    setLoading(true);
    try {
      const postPayload = {
        user_id: user.id,
        type: postType,
        title: title.trim(),
        content: content.trim(),
        image_url: imageUrl,
        industry: industry,
        is_sponsored: false,
        criteria,
      };

      const { error } = initialPost
        ? await updatePost(initialPost.id, postPayload)
        : await addPost(postPayload);

      if (error) throw error;

      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearForm();
      onSuccess?.();
    } catch (err: any) {
      Flash.show({
        type: "danger",
        message: "Create Post Error",
        description: err?.message || String(err),
      });
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return {
    title,
    setTitle,
    content,
    setContent,
    imageUrl,
    setImageUrl,
    handleImageSelected,
    loading,
    postType,
    handlePostTypeChange,
    jobFields,
    setJobFields,
    articleFields,
    setArticleFields,
    handleSubmit,
    isFormValid,
    clearForm
  };
}
