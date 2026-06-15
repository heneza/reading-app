export type NotificationLike = {
  type: string;
  actor_id?: string | null;
  post_id?: string | null;
  book_id?: string | null;
  read?: boolean;
};

export type NotificationContext = {
  actorUsername?: string | null;
  viewerUsername?: string | null;
};

function actorLabel(username?: string | null) {
  return username ? `@${username}` : 'Someone';
}

export function notificationText(
  notification: NotificationLike,
  context: NotificationContext = {}
) {
  const actor = actorLabel(context.actorUsername);

  switch (notification.type) {
    case 'follow':
      return `${actor} followed you`;
    case 'new_user':
      return `${actor} joined`;
    case 'post_comment':
      return `${actor} commented on your post`;
    case 'review_comment':
      return `${actor} replied to your review`;
    case 'article_pending':
      return `${actor} submitted an article`;
    case 'article_approved':
      return 'Your article was approved';
    case 'article_rejected':
      return 'Your article was not approved';
    default:
      return 'New notification';
  }
}

export function notificationHref(
  notification: NotificationLike,
  context: NotificationContext = {}
) {
  switch (notification.type) {
    case 'follow':
    case 'new_user':
      return context.actorUsername ? `/u/${context.actorUsername}` : '/notifications';
    case 'post_comment':
      return context.viewerUsername ? `/u/${context.viewerUsername}?tab=posts` : '/notifications';
    case 'review_comment':
      return notification.book_id ? `/book/${notification.book_id}` : '/notifications';
    case 'article_approved':
      return '/articles';
    default:
      return '/notifications';
  }
}
