import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AudioPillPlayer from '../../components/common/AudioPillPlayer';
import PageHero from '../../components/common/PageHero';
import Card from '../../components/ui/Card';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import hukamnamaService from '../../services/hukamnamaService';

const toDisplayDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  return date.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
};

const HukamnamaPage = () => {
  const meta = useSeoMeta('Daily Hukamnama', 'Read today\'s hukamnama with translation, meaning, and archived entries.');
  const readAlongConfig = useMemo(() => hukamnamaService.getReadAlongConfig(), []);
  const todayDateKey = new Date().toISOString().slice(0, 10);
  const { data: dailyHukamnama } = useQuery({
    queryKey: ['daily-hukamnama', todayDateKey],
    queryFn: () => hukamnamaService.getDailyHukamnama(todayDateKey).then((res) => res.data)
  });
  const currentHukamnama = dailyHukamnama?.entry || null;
  const currentAng = Math.max(1, Number(currentHukamnama?.ang || 0));

  const { data: readAlongAudio } = useQuery({
    queryKey: ['hukamnama-read-along-page', currentAng],
    queryFn: () => hukamnamaService.getReadAlongAudioUrl(currentAng).then((res) => res.data),
    enabled: currentAng > 0 && readAlongConfig.enabled
  });

  const { data: archive = [] } = useQuery({
    queryKey: ['hukamnama-archive'],
    queryFn: () => hukamnamaService.getArchive().then((res) => res.data)
  });

  const hukamnamaDateLabel = toDisplayDate(currentHukamnama?.date || currentHukamnama?.updatedAt);

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title="Daily Hukamnama" description="Today’s hukamnama, translation, interpretation, and historical archive." />
      <Card>
        <div className="space-y-2">
          {readAlongAudio?.url ? (
            <div className="w-full">
              <AudioPillPlayer
                label="Singh Sabha Milton"
                subtitle={`Ang ${currentAng} | ${hukamnamaDateLabel}`}
                src={readAlongAudio.url}
                showProgress
              />
            </div>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          {!currentHukamnama ? (
            <p className="text-sm text-slate-500">Today\'s hukamnama is not available yet.</p>
          ) : (currentHukamnama.lines || []).map((line) => (
            <div key={line.id}>
              <p className="font-gurmukhi text-lg font-bold leading-relaxed text-brand-navy">{line.gurmukhi}</p>
              {line.translationPunjabi ? <p className="mt-1 text-sm font-normal text-brand-saffron">Punjabi: {line.translationPunjabi}</p> : null}
              {line.translationEnglish ? <p className="mt-0.5 text-sm font-normal text-brand-blue">English: {line.translationEnglish}</p> : null}
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
