import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Upload,
  Image as ImageIcon,
  Loader2,
  X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBlogCategories, useBlogTags } from '@/hooks/useBlogCategories';
import { useCreateBlogPost, useUpdateBlogPost, useUploadBlogImage } from '@/hooks/useBlogAdmin';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer';
import type { BlogPost, BlogPostFormData } from '@/types/blog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function AdminBlogEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [previewMode, setPreviewMode] = useState<'write' | 'preview'>('write');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const { data: categories } = useBlogCategories();
  const { data: tags } = useBlogTags();
  const createMutation = useCreateBlogPost();
  const updateMutation = useUpdateBlogPost();
  const uploadMutation = useUploadBlogImage();

  // Fetch existing post if editing
  const { data: existingPost, isLoading: postLoading } = useQuery({
    queryKey: ['admin-blog-post', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          category:blog_categories(*),
          author:profiles(id, display_name, avatar_url)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch tags
      const { data: postTags } = await supabase
        .from('blog_post_tags')
        .select('tag_id')
        .eq('post_id', id);

      return {
        ...data,
        tag_ids: postTags?.map(pt => pt.tag_id) || [],
      } as BlogPost & { tag_ids: string[] };
    },
    enabled: !!id,
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BlogPostFormData>({
    defaultValues: {
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      cover_image_url: '',
      category_id: '',
      status: 'draft',
      meta_title: '',
      meta_description: '',
      tag_ids: [],
    },
  });

  // Populate form with existing data
  useEffect(() => {
    if (existingPost) {
      setValue('title', existingPost.title);
      setValue('slug', existingPost.slug);
      setValue('excerpt', existingPost.excerpt || '');
      setValue('content', existingPost.content);
      setValue('cover_image_url', existingPost.cover_image_url || '');
      setValue('category_id', existingPost.category_id || '');
      setValue('status', existingPost.status);
      setValue('meta_title', existingPost.meta_title || '');
      setValue('meta_description', existingPost.meta_description || '');
      setSelectedTags(existingPost.tag_ids || []);
      if (existingPost.cover_image_url) {
        setCoverPreview(existingPost.cover_image_url);
      }
    }
  }, [existingPost, setValue]);

  const title = watch('title');
  const content = watch('content');
  const slug = watch('slug');

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEditing && title && !slug) {
      setValue('slug', generateSlug(title));
    }
  }, [title, isEditing, slug, setValue]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadMutation.mutateAsync(file);
      setValue('cover_image_url', url);
      setCoverPreview(url);
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      toast.error('Erro ao enviar imagem');
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const onSubmit = async (data: BlogPostFormData) => {
    try {
      const formData = {
        ...data,
        tag_ids: selectedTags,
      };

      if (isEditing && id) {
        await updateMutation.mutateAsync({ id, formData });
        toast.success('Post atualizado com sucesso!');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Post criado com sucesso!');
      }
      navigate('/admin/blog');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar post');
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isEditing && postLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/blog">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold">
              {isEditing ? 'Editar Post' : 'Novo Post'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {existingPost?.status === 'published' && (
              <Button variant="outline" asChild>
                <Link to={`/blog/${existingPost.slug}`} target="_blank">
                  <Eye className="h-4 w-4 mr-2" />
                  Ver post
                </Link>
              </Button>
            )}
            <Button onClick={handleSubmit(onSubmit)} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)}>
        <main className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Digite o título do post"
                  className="text-lg h-12"
                  {...register('title', { required: true })}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">Título é obrigatório</p>
                )}
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <Label htmlFor="slug">URL (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/blog/</span>
                  <Input
                    id="slug"
                    placeholder="url-do-post"
                    {...register('slug')}
                  />
                </div>
              </div>

              {/* Excerpt */}
              <div className="space-y-2">
                <Label htmlFor="excerpt">Resumo (excerpt)</Label>
                <Textarea
                  id="excerpt"
                  placeholder="Breve descrição do post para listagens e SEO"
                  rows={2}
                  {...register('excerpt')}
                />
              </div>

              {/* Content Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Conteúdo *</Label>
                  <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as 'write' | 'preview')}>
                    <TabsList className="h-8">
                      <TabsTrigger value="write" className="text-xs px-3">Escrever</TabsTrigger>
                      <TabsTrigger value="preview" className="text-xs px-3">Preview</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                {previewMode === 'write' ? (
                  <Textarea
                    placeholder="Escreva seu conteúdo em Markdown..."
                    rows={20}
                    className="font-mono text-sm"
                    {...register('content', { required: true })}
                  />
                ) : (
                  <div className="border border-border rounded-lg p-6 min-h-[400px] bg-card">
                    {content ? (
                      <MarkdownRenderer content={content} />
                    ) : (
                      <p className="text-muted-foreground text-center py-12">
                        Nenhum conteúdo para visualizar
                      </p>
                    )}
                  </div>
                )}
                {errors.content && (
                  <p className="text-sm text-destructive">Conteúdo é obrigatório</p>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Status */}
              <div className="glass-card p-4 space-y-4">
                <Label>Status</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(v) => setValue('status', v as 'draft' | 'published' | 'archived')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cover Image */}
              <div className="glass-card p-4 space-y-4">
                <Label>Imagem de capa</Label>
                {coverPreview ? (
                  <div className="relative">
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="w-full aspect-video object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => {
                        setCoverPreview(null);
                        setValue('cover_image_url', '');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    {uploadMutation.isPending ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">
                          Clique para enviar
                        </span>
                      </>
                    )}
                  </label>
                )}
              </div>

              {/* Category */}
              <div className="glass-card p-4 space-y-4">
                <Label>Categoria</Label>
                <Select
                  value={watch('category_id') || ''}
                  onValueChange={(v) => setValue('category_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="glass-card p-4 space-y-4">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {tags?.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {tags?.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma tag disponível</p>
                  )}
                </div>
              </div>

              {/* SEO */}
              <div className="glass-card p-4 space-y-4">
                <Label>SEO</Label>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="meta_title" className="text-xs text-muted-foreground">
                      Meta Title
                    </Label>
                    <Input
                      id="meta_title"
                      placeholder="Título para SEO (opcional)"
                      {...register('meta_title')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="meta_description" className="text-xs text-muted-foreground">
                      Meta Description
                    </Label>
                    <Textarea
                      id="meta_description"
                      placeholder="Descrição para SEO (max 160 caracteres)"
                      rows={3}
                      {...register('meta_description')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </form>
    </div>
  );
}
