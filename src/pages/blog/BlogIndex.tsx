import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { HelmetProvider } from 'react-helmet-async';
import { BlogHeader } from '@/components/blog/BlogHeader';
import { BlogCard } from '@/components/blog/BlogCard';
import { BlogSEO } from '@/components/blog/BlogSEO';
import { useBlogPosts } from '@/hooks/useBlogPosts';
import { useBlogCategories } from '@/hooks/useBlogCategories';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const categoryColors: Record<string, string> = {
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30',
};

export default function BlogIndex() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const { data: posts, isLoading: postsLoading } = useBlogPosts({ 
    limit: 50,
    categorySlug: selectedCategory || undefined,
  });
  const { data: categories, isLoading: categoriesLoading } = useBlogCategories();

  // Filter posts by search query
  const filteredPosts = posts?.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <HelmetProvider>
      <BlogSEO />
      <div className="min-h-screen bg-background">
        <BlogHeader />

        {/* Hero Section */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
                BioPeak <span className="text-primary">Blog</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8">
                Dicas de treinamento, nutrição, recuperação e tecnologia para você 
                alcançar sua melhor performance.
              </p>

              {/* Search */}
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar artigos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 bg-card border-border"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-6 border-y border-border bg-card/50">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="shrink-0"
              >
                Todos
              </Button>
              {categoriesLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-24 rounded-full" />
                ))
              ) : (
                categories?.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant="outline"
                    className={`cursor-pointer shrink-0 px-4 py-1.5 text-sm transition-colors ${
                      selectedCategory === cat.slug 
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' 
                        : ''
                    } ${categoryColors[cat.color] || categoryColors.blue}`}
                    onClick={() => setSelectedCategory(cat.slug === selectedCategory ? null : cat.slug)}
                  >
                    {cat.name}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Posts Grid */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            {postsLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="glass-card overflow-hidden">
                    <Skeleton className="aspect-video" />
                    <div className="p-5 space-y-3">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredPosts && filteredPosts.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {searchQuery ? 'Nenhum artigo encontrado' : 'Nenhum artigo publicado ainda'}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? 'Tente buscar por outros termos.'
                    : 'Em breve teremos conteúdo incrível para você!'
                  }
                </p>
              </div>
            )}
          </div>
        </section>

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
