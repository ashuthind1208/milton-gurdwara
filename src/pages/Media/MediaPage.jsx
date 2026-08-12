import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import PageHero from '../../components/common/PageHero';
import GalleryCard from '../../components/cards/GalleryCard';
import Card from '../../components/ui/Card';
import galleryService from '../../services/galleryService';
import videoService, { getYouTubeThumbnail } from '../../services/videoService';

const MediaPage = () => {
  const meta = useSeoMeta('Media Hub', 'Explore photo galleries and video recordings from the sangat in one place.');
  const [activeTab, setActiveTab] = useState('gallery');

  const { data: albums = [] } = useQuery({
    queryKey: ['gallery-public'],
    queryFn: () => galleryService.getPublicAlbums().then((res) => res.data)
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['gurdwara-videos'],
    queryFn: () => videoService.getVideos().then((res) => res.data)
  });

  const featuredVideos = useMemo(() => videos.slice(0, 9), [videos]);

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero
        title="Media Hub"
        description="Photo galleries and video recordings together in one place for quick browsing."
      />

      <section>
        <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${activeTab === 'gallery' ? 'bg-brand-blue text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              Gallery Albums
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('videos')}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${activeTab === 'videos' ? 'bg-brand-blue text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              Video Library
            </button>
        </div>
        <hr className="mt-5 border-slate-200" />
      </section>

      {activeTab === 'gallery' ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-heading text-2xl font-semibold text-slate-900">Gallery Highlights</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{albums.length} albums</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <GalleryCard key={album.id} album={album} />
            ))}
            {albums.length === 0 ? <p className="col-span-full py-8 text-center text-slate-500">No gallery albums are live yet.</p> : null}
          </div>
        </section>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-heading text-2xl font-semibold text-slate-900">Video Highlights</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{videos.length} videos</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredVideos.map((video) => {
              const thumb = video.thumbnailUrl || getYouTubeThumbnail(video.videoUrl);
              return (
                <Card key={video.id} className="overflow-hidden p-0">
                  <a href={video.videoUrl} target="_blank" rel="noreferrer" className="group block">
                    <div className="aspect-video w-full overflow-hidden bg-slate-900">
                      {thumb ? <img src={thumb} alt={video.title} className="h-full w-full object-cover opacity-85 transition group-hover:opacity-60" /> : null}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{video.category || 'Video'}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900">{video.title}</p>
                    </div>
                  </a>
                </Card>
              );
            })}
            {videos.length === 0 ? <p className="col-span-full py-8 text-center text-slate-500">No videos are live yet.</p> : null}
          </div>
        </section>
      )}
    </div>
  );
};

export default MediaPage;
