import { Link } from 'react-router-dom';
import { useRelatedPosts } from '@/hooks/useBlogPosts';
import type { BlogPost } from '@/types/blog';
import { Skeleton } from '@/components/ui/skeleton';

interface RelatedPostsProps {
  currentPost: BlogPost;
}

export function RelatedPosts({ currentPost }: RelatedPostsProps) {
  const { data: posts, isLoading } = useRelatedPosts(
    currentPost.id,
    currentPost.category_id,
    3
  );

  if (isLoading) {
    return (
      <section className="mt-12 pt-8 border-t border-border">
        <h3 className="text-xl font-bold mb-6">Leia também</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (!posts || posts.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h3 className="text-xl font-bold mb-6">Leia também</h3>
      <div className="grid md:grid-cols-3 gap-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/blog/${post.slug}`}
            className="glass-card p-4 group"
          >
            {post.cover_image_url && (
              <div className="aspect-video rounded-md overflow-hidden mb-3">
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}
            <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {post.title}
            </h4>
            <span className="text-xs text-muted-foreground mt-2 block">
              {post.reading_time_minutes} min de leitura
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
