export type PostCardInteractions = {
  reactions: any[];
  comments: any[];
  reposters: any[];
  commentAuthors: Map<string, any>;
};

export type PostCardInteractionMap = Map<string, PostCardInteractions>;

function emptyInteractions(): PostCardInteractions {
  return {
    reactions: [],
    comments: [],
    reposters: [],
    commentAuthors: new Map(),
  };
}

export async function loadPostCardInteractions(
  supabase: any,
  posts: any[]
): Promise<PostCardInteractionMap> {
  const postIds = Array.from(
    new Set(posts.map((post) => post?.id).filter(Boolean))
  );
  const byPost: PostCardInteractionMap = new Map(
    postIds.map((id) => [id, emptyInteractions()])
  );

  if (postIds.length === 0) return byPost;

  const [reactionRes, commentRes, repostRes] = await Promise.all([
    supabase
      .from('post_reactions')
      .select('post_id, user_id, type')
      .in('post_id', postIds),
    supabase
      .from('post_comments')
      .select('id, post_id, user_id, body, created_at')
      .in('post_id', postIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('post_reposts')
      .select('post_id, user_id')
      .in('post_id', postIds),
  ]);

  (reactionRes.data ?? []).forEach((row: any) => {
    byPost.get(row.post_id)?.reactions.push(row);
  });
  (commentRes.data ?? []).forEach((row: any) => {
    byPost.get(row.post_id)?.comments.push(row);
  });
  (repostRes.data ?? []).forEach((row: any) => {
    byPost.get(row.post_id)?.reposters.push(row);
  });

  const commentUserIds = Array.from(
    new Set((commentRes.data ?? []).map((comment: any) => comment.user_id))
  );

  if (commentUserIds.length) {
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', commentUserIds);
    const commentAuthors = new Map<string, any>();
    (authors ?? []).forEach((author: any) => commentAuthors.set(author.id, author));
    byPost.forEach((interactions) => {
      interactions.commentAuthors = commentAuthors;
    });
  }

  return byPost;
}
