import { Link } from 'react-router-dom';
import { Calendar, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { BlogPost } from '@/types/blog';
import { Badge } from '@/components/ui/badge';

interface BlogCardProps {
  post: BlogPost;
}

const categoryColors: Record<string, string> = {
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export function BlogCard({ post }: BlogCardProps) {
  const categoryColor = post.category?.color || 'blue';

  return (
    <Link to={`/blog/${post.slug}`} className="block group">
      <article className="glass-card overflow-hidden h-full flex flex-col">
        {/* Cover Image */}
        {post.cover_image_url ? (
          <div className="aspect-video overflow-hidden">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <span className="text-4xl font-bold text-primary/30">BP</span>
          </div>
        )}

        <div className="p-5 flex flex-col flex-1">
          {/* Category Badge */}
          {post.category && (
            <Badge 
              variant="outline" 
              className={`w-fit mb-3 ${categoryColors[categoryColor] || categoryColors.blue}`}
            >
              {post.category.name}
            </Badge>
          )}

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h2>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-muted-foreground text-sm mb-4 line-clamp-3 flex-1">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-4 border-t border-border">
            {post.published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(post.published_at), "d 'de' MMM, yyyy", { locale: ptBR })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {post.reading_time_minutes} min de leitura
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
