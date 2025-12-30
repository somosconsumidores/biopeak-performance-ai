import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BlogPostFormData, BlogPost } from '@/types/blog';
import { useAuth } from '@/hooks/useAuth';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function useCreateBlogPost() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (formData: BlogPostFormData): Promise<BlogPost> => {
      const slug = formData.slug || generateSlug(formData.title);
      const readingTime = calculateReadingTime(formData.content);

      const { data, error } = await supabase
        .from('blog_posts')
        .insert({
          title: formData.title,
          slug,
          excerpt: formData.excerpt || null,
          content: formData.content,
          cover_image_url: formData.cover_image_url || null,
          category_id: formData.category_id || null,
          status: formData.status,
          meta_title: formData.meta_title || null,
          meta_description: formData.meta_description || null,
          reading_time_minutes: readingTime,
          author_id: user?.id || null,
          published_at: formData.status === 'published' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add tags
      if (formData.tag_ids.length > 0) {
        const tagInserts = formData.tag_ids.map(tagId => ({
          post_id: data.id,
          tag_id: tagId,
        }));

        await supabase.from('blog_post_tags').insert(tagInserts);
      }

      return data as BlogPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
    },
  });
}

export function useUpdateBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: BlogPostFormData }): Promise<BlogPost> => {
      const readingTime = calculateReadingTime(formData.content);

      // Get current post to check status change
      const { data: currentPost } = await supabase
        .from('blog_posts')
        .select('status, published_at')
        .eq('id', id)
        .single();

      const publishedAt = formData.status === 'published' && currentPost?.status !== 'published'
        ? new Date().toISOString()
        : currentPost?.published_at;

      const { data, error } = await supabase
        .from('blog_posts')
        .update({
          title: formData.title,
          slug: formData.slug || generateSlug(formData.title),
          excerpt: formData.excerpt || null,
          content: formData.content,
          cover_image_url: formData.cover_image_url || null,
          category_id: formData.category_id || null,
          status: formData.status,
          meta_title: formData.meta_title || null,
          meta_description: formData.meta_description || null,
          reading_time_minutes: readingTime,
          published_at: publishedAt,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update tags - remove old and add new
      await supabase.from('blog_post_tags').delete().eq('post_id', id);

      if (formData.tag_ids.length > 0) {
        const tagInserts = formData.tag_ids.map(tagId => ({
          post_id: id,
          tag_id: tagId,
        }));

        await supabase.from('blog_post_tags').insert(tagInserts);
      }

      return data as BlogPost;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      queryClient.invalidateQueries({ queryKey: ['blog-post', data.slug] });
    },
  });
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
    },
  });
}

export function useCreateBlogTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const slug = generateSlug(name);
      const { data, error } = await supabase
        .from('blog_tags')
        .insert({ name, slug })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] });
    },
  });
}

export function useUploadBlogImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(filePath);

      return publicUrl;
    },
  });
}
