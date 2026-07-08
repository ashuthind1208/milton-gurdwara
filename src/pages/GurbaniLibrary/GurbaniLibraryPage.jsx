import PageHero from '../../components/common/PageHero';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';

const items = ['Nitnem', 'Shabads', 'Audio', 'Videos', 'Downloads', 'Search'];

const GurbaniLibraryPage = () => {
  const meta = useSeoMeta('Gurbani Library', 'Search Gurbani resources including nitnem, shabads, audio, and downloadable files.');
  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title="Gurbani Library" description="Digital access to daily nitnem, shabads, recordings, and educational downloads." />
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="border-b border-slate-200 pb-3">
            <h3 className="font-heading text-lg font-semibold text-brand-blue">{item}</h3>
            <p className="mt-1 text-sm text-slate-700">Content module with indexed metadata and search-ready structure.</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GurbaniLibraryPage;
