import { useQuery } from '@tanstack/react-query';
import AudioPillPlayer from '../../components/common/AudioPillPlayer';
import PageHero from '../../components/common/PageHero';
import Card from '../../components/ui/Card';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import hukamnamaService from '../../services/hukamnamaService';

const HukamnamaPage = () => {
  const meta = useSeoMeta('Daily Hukamnama', 'Read today\'s hukamnama with translation, meaning, and archived entries.');
  const { data: currentHukamnama } = useQuery({
    queryKey: ['current-hukamnama'],
    queryFn: () => hukamnamaService.getCurrentHukamnama().then((res) => res.data)
  });

  const { data: archive = [] } = useQuery({
    queryKey: ['hukamnama-archive'],
    queryFn: () => hukamnamaService.getArchive().then((res) => res.data)
  });

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title="Daily Hukamnama" description="Today’s hukamnama, translation, interpretation, and historical archive." />
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Hukamnama</p>
            <p className="mt-1 text-lg font-semibold text-brand-blue">Ang {currentHukamnama?.ang}</p>
          </div>
          <div className="w-full md:max-w-xs">
            <AudioPillPlayer label="Daily Mukhwak" subtitle="Sri Darbar Sahib audio" src={currentHukamnama?.audioUrl} />
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {(currentHukamnama?.lines || []).map((line) => (
            <div key={line.id}>
              <p className="font-gurmukhi text-xl text-brand-navy dark:text-brand-cream">{line.gurmukhi}</p>
              {line.translationPunjabi ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Punjabi: {line.translationPunjabi}</p> : null}
              {line.translationEnglish ? <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">English: {line.translationEnglish}</p> : null}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-heading text-lg font-semibold">Archive</h3>
        <div className="mt-3 space-y-3">
          {archive.length === 0 ? (
            <p className="text-sm">Browse past hukamnama entries by date, topic, and source reference.</p>
          ) : archive.map((item) => (
            <div key={`${item.ang}-${item.updatedAt}`} className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
              <p className="font-semibold text-brand-blue">Ang {item.ang}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.preview}</p>
              <p className="mt-1 text-xs text-slate-500">Updated {new Date(item.updatedAt).toLocaleDateString('en-CA')}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default HukamnamaPage;
