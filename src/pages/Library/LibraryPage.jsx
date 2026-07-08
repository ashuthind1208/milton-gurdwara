import PageHero from '../../components/common/PageHero';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';

const LibraryPage = () => {
  const meta = useSeoMeta('Library', 'Books, PDFs, and downloadable resources for Sikh learning.');

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title="Library" description="Books, PDFs, and downloadable Sikh resources for all age groups." />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border-b border-slate-200 pb-3"><h3 className="font-heading text-lg font-semibold text-brand-blue">Books</h3><p className="mt-1 text-sm text-slate-700">Curated titles for Sikh history and philosophy.</p></div>
        <div className="border-b border-slate-200 pb-3"><h3 className="font-heading text-lg font-semibold text-brand-blue">PDFs</h3><p className="mt-1 text-sm text-slate-700">Study guides, handouts, and educational materials.</p></div>
        <div className="border-b border-slate-200 pb-3"><h3 className="font-heading text-lg font-semibold text-brand-blue">Downloads</h3><p className="mt-1 text-sm text-slate-700">Community calendars, event packs, and forms.</p></div>
      </div>
    </div>
  );
};

export default LibraryPage;
