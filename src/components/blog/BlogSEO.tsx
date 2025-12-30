import { Helmet } from 'react-helmet-async';
import type { BlogPost } from '@/types/blog';

interface BlogSEOProps {
  post?: BlogPost;
  title?: string;
  description?: string;
}

const BASE_URL = 'https://biopeak.com.br';

export function BlogSEO({ post, title, description }: BlogSEOProps) {
  if (post) {
    const pageTitle = post.meta_title || post.title;
    const pageDescription = post.meta_description || post.excerpt || '';
    const canonicalUrl = `${BASE_URL}/blog/${post.slug}`;
    const imageUrl = post.cover_image_url || `${BASE_URL}/og-image.png`;

    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: pageDescription,
      image: imageUrl,
      datePublished: post.published_at,
      dateModified: post.updated_at,
      author: {
        '@type': 'Person',
        name: post.author?.display_name || 'BioPeak',
      },
      publisher: {
        '@type': 'Organization',
        name: 'BioPeak',
        logo: {
          '@type': 'ImageObject',
          url: `${BASE_URL}/logo.png`,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
    };

    return (
      <Helmet>
        <title>{pageTitle} | BioPeak Blog</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:site_name" content="BioPeak Blog" />
        <meta property="article:published_time" content={post.published_at || ''} />
        <meta property="article:modified_time" content={post.updated_at} />
        {post.category && <meta property="article:section" content={post.category.name} />}

        {/* Twitter Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={imageUrl} />

        {/* Schema.org */}
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      </Helmet>
    );
  }

  // Default blog index SEO
  const defaultTitle = title || 'BioPeak Blog';
  const defaultDescription = description || 'Dicas de treinamento, nutrição, recuperação e tecnologia para atletas. Conteúdo especializado para você alcançar sua melhor performance.';

  return (
    <Helmet>
      <title>{defaultTitle}</title>
      <meta name="description" content={defaultDescription} />
      <link rel="canonical" href={`${BASE_URL}/blog`} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={defaultTitle} />
      <meta property="og:description" content={defaultDescription} />
      <meta property="og:url" content={`${BASE_URL}/blog`} />
      <meta property="og:site_name" content="BioPeak Blog" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={defaultTitle} />
      <meta name="twitter:description" content={defaultDescription} />
    </Helmet>
  );
}
