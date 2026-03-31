type PostWithCriteria = {
  type?: string | null;
  created_at?: string | null;
  criteria?: {
    deadline?: string | null;
    [key: string]: any;
  } | null;
};

export const isJobExpired = (post: PostWithCriteria, now = new Date()) => {
  if (post.type !== "job") {
    return false;
  }

  const deadline = post.criteria?.deadline;
  if (!deadline) {
    return false;
  }

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return false;
  }

  return deadlineDate.getTime() < now.getTime();
};

export const isNewsExpired = (post: PostWithCriteria, now = new Date()) => {
  if (post.type !== "news") {
    return false;
  }

  if (!post.created_at) {
    return false;
  }

  const createdAt = new Date(post.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + 5);

  return expiresAt.getTime() < now.getTime();
};

export const isPostExpired = (post: PostWithCriteria, now = new Date()) =>
  isJobExpired(post, now) || isNewsExpired(post, now);

export const filterExpiredPublicPosts = <T extends PostWithCriteria>(
  posts: T[],
  now = new Date()
) => posts.filter((post) => !isPostExpired(post, now));

export const formatDeadlineLabel = (deadline?: string | null) => {
  if (!deadline) {
    return "";
  }

  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
