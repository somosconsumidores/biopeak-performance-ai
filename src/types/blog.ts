export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface BlogAuthor {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  author_id: string | null;
  category_id: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  reading_time_minutes: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  // Joined relations
  category?: BlogCategory | null;
  author?: BlogAuthor | null;
  tags?: BlogTag[];
}

export interface BlogPostFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  category_id: string;
  status: 'draft' | 'published' | 'archived';
  meta_title: string;
  meta_description: string;
  tag_ids: string[];
}
