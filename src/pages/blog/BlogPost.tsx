import { useParams, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, Eye } from 'lucide-react';
import { HelmetProvider } from 'react-helmet-async';
import { BlogHeader } from '@/components/blog/BlogHeader';
import { BlogSEO } from '@/components/blog/BlogSEO';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer';
import { ShareButtons } from '@/components/blog/ShareButtons';
import { RelatedPosts } from '@/components/blog/RelatedPosts';
import { useBlogPost } from '@/hooks/useBlogPosts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const categoryColors: Record<string, string> = {
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, error } = useBlogPost(slug || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <BlogHeader showBack />
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <Skeleton className="aspect-video rounded-xl mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!post || error) {
    return <Navigate to="/blog" replace />;
  }

  const canonicalUrl = `https://biopeak.com.br/blog/${post.slug}`;
  const categoryColor = post.category?.color || 'blue';

  return (
    <HelmetProvider>
      <BlogSEO post={post} />
      <div className="min-h-screen bg-background">
        <BlogHeader showBack />

        <article className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
          {/* Header */}
          <header className="mb-8">
            {/* Category */}
            {post.category && (
              <Badge 
                variant="outline" 
                className={`mb-4 ${categoryColors[categoryColor] || categoryColors.blue}`}
              >
                {post.category.name}
              </Badge>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-lg md:text-xl text-muted-foreground mb-6">
                {post.excerpt}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-6 border-b border-border">
              {/* Author */}
              {post.author && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={post.author.avatar_url || undefined} />
                    <AvatarFallback>
                      {post.author.display_name?.[0]?.toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">
                    {post.author.display_name || 'BioPeak'}
                  </span>
                </div>
              )}

              {/* Date */}
              {post.published_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(post.published_at), "d 'de' MMMM, yyyy", { locale: ptBR })}
                </span>
              )}

              {/* Reading Time */}
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.reading_time_minutes} min de leitura
              </span>

              {/* Views */}
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {post.view_count} visualizações
              </span>
            </div>
          </header>

          {/* Cover Image */}
          {post.cover_image_url && (
            <div className="mb-10 rounded-xl overflow-hidden shadow-lg">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="w-full h-auto aspect-video object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="mb-10">
            <MarkdownRenderer content={post.content} />
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8 pb-8 border-b border-border">
              {post.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  #{tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Share */}
          <div className="mb-10 py-6 border-y border-border">
            <ShareButtons url={canonicalUrl} title={post.title} />
          </div>

          {/* Related Posts */}
          <RelatedPosts currentPost={post} />
        </article>

        {/* Footer */}
        <footer className="py-8 border-t border-border">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} BioPeak. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>
    </HelmetProvider>
  );
}
