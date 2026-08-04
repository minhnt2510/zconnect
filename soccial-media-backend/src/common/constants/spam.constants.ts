export const SPAM = {
  POST_WINDOW_MS: 10 * 60 * 1000,
  MAX_POSTS_PER_WINDOW: 3,
  COMMENT_WINDOW_MS: 10 * 60 * 1000,
  MAX_COMMENTS_PER_WINDOW: 5,
  DUPLICATE_WINDOW_MS: 24 * 60 * 60 * 1000,
  DUPLICATE_LIMIT: 2,
} as const;

export const SPAM_BLOCK_MESSAGE =
  'Phát hiện spam. Tài khoản của bạn đã bị khóa, chờ admin duyệt (khoảng 1 tuần) để tiếp tục bình luận.';

export const SPAM_RESTRICTED_MESSAGE =
  'Tài khoản của bạn đang bị khóa do vi phạm. Chờ admin duyệt (khoảng 1 tuần) để tiếp tục hoạt động.';
