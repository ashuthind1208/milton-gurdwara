import PageHero from '../../components/common/PageHero';
import { useQuery } from '@tanstack/react-query';
import NewsCard from '../../components/cards/NewsCard';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import newsService from '../../services/newsService';

const NewsPage = () => {
  const meta = useSeoMeta('News', 'Latest announcements, blogs, and community news.');
  const { data: articles = [] } = useQuery({ queryKey: ['news-articles'], queryFn: () => newsService.getArticles().then((res) => res.data) });

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title="News and Articles" description="Latest announcements, blogs, and community insights." />
      <div className="space-y-4">
        {articles.map((article) => <NewsCard key={article.id} article={article} />)}
      </div>
    </div>
  );
};

export default NewsPage;
