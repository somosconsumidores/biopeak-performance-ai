import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BlogPost } from '@/types/blog';

interface UseBlogPostsOptions {
  limit?: number;
  categorySlug?: string;
  tagSlug?: string;
  includeUnpublished?: boolean;
}

export function useBlogPosts(options: UseBlogPostsOptions = {}) {
  const { limit = 10, categorySlug, tagSlug, includeUnpublished = false } = options;

  return useQuery({
    queryKey: ['blog-posts', { limit, categorySlug, tagSlug, includeUnpublished }],
    queryFn: async (): Promise<BlogPost[]> => {
      let query = supabase
        .from('blog_posts')
        .select(`
          *,
          category:blog_categories(*),
          author:profiles(id, display_name, avatar_url)
        `)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (!includeUnpublished) {
        query = query.eq('status', 'published');
      }

      if (categorySlug) {
        const { data: category } = await supabase
          .from('blog_categories')
          .select('id')
          .eq('slug', categorySlug)
          .single();
        
        if (category) {
          query = query.eq('category_id', category.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch tags for each post
      const postsWithTags = await Promise.all(
        (data || []).map(async (post) => {
          const { data: postTags } = await supabase
            .from('blog_post_tags')
            .select('tag_id, blog_tags(*)')
            .eq('post_id', post.id);

          return {
            ...post,
            tags: postTags?.map((pt: any) => pt.blog_tags).filter(Boolean) || [],
          } as BlogPost;
        })
      );

      return postsWithTags;
    },
  });
}

export function useBlogPost(slug: string) {
  return useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async (): Promise<BlogPost | null> => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          category:blog_categories(*),
          author:profiles(id, display_name, avatar_url)
        `)
        .eq('slug', slug)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      // Fetch tags
      const { data: postTags } = await supabase
        .from('blog_post_tags')
        .select('tag_id, blog_tags(*)')
        .eq('post_id', data.id);

      // Increment view count
      await supabase
        .from('blog_posts')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', data.id);

      return {
        ...data,
        tags: postTags?.map((pt: any) => pt.blog_tags).filter(Boolean) || [],
      } as BlogPost;
    },
    enabled: !!slug,
  });
}

export function useRelatedPosts(postId: string, categoryId: string | null, limit = 3) {
  return useQuery({
    queryKey: ['related-posts', postId, categoryId],
    queryFn: async (): Promise<BlogPost[]> => {
      let query = supabase
        .from('blog_posts')
        .select(`
          *,
          category:blog_categories(*)
        `)
        .eq('status', 'published')
        .neq('id', postId)
        .limit(limit);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BlogPost[];
    },
    enabled: !!postId,
  });
}
