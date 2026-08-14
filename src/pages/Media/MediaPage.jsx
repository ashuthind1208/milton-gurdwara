import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import PageHero from '../../components/common/PageHero';
import GalleryCard from '../../components/cards/GalleryCard';
import Card from '../../components/ui/Card';
import galleryService from '../../services/galleryService';
import videoService, { getFacebookEmbedUrl, getYouTubeEmbedUrl, getYouTubeThumbnail } from '../../services/videoService';

const getVideoEmbedUrl = (video) => {
  if (video?.platform === 'youtube') {
    const embedUrl = getYouTubeEmbedUrl(video.videoUrl);
    if (!embedUrl) return '';
    return `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1&playsinline=1&rel=0`;
  }
  if (video?.platform === 'facebook') {
    return `${getFacebookEmbedUrl(video.videoUrl)}&autoplay=true`;
  }
  return '';
};

const MediaPage = () => {
  const meta = useSeoMeta('Media Hub', 'Explore photo galleries and video recordings from the sangat in one place.');
  const [activeTab, setActiveTab] = useState('gallery');
  const [activeVideo, setActiveVideo] = useState(null);

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
                  <button type="button" onClick={() => setActiveVideo(video)} className="group block w-full text-left">
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                      {thumb ? <img src={thumb} alt={video.title} className="h-full w-full object-cover opacity-85 transition group-hover:opacity-60" /> : null}
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white">
                          <PlayIcon className="h-6 w-6" />
                        </span>
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{video.category || 'Video'}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900">{video.title}</p>
                    </div>
                  </button>
                </Card>
              );
            })}
            {videos.length === 0 ? <p className="col-span-full py-8 text-center text-slate-500">No videos are live yet.</p> : null}
          </div>
        </section>
      )}

      {activeVideo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="media-video-title">
          <button type="button" className="absolute inset-0 bg-slate-900/70" aria-label="Close video dialog" onClick={() => setActiveVideo(null)} />
          <div className="relative z-10 max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="w-full bg-black">
              <div className="mx-auto aspect-video max-h-[72vh] w-full">
                {getVideoEmbedUrl(activeVideo) ? (
                  <iframe
                    className="h-full w-full"
                    src={getVideoEmbedUrl(activeVideo)}
                    title={activeVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video className="h-full w-full" src={activeVideo.videoUrl} controls autoPlay playsInline />
                )}
              </div>
            </div>
            <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
              <div>
                <h3 id="media-video-title" className="font-heading text-base font-semibold text-slate-800">{activeVideo.title}</h3>
                <p className="text-xs text-slate-500">{activeVideo.category || 'Video'}{activeVideo.featuredDate ? ` · ${activeVideo.featuredDate}` : ''}</p>
                {activeVideo.description ? <p className="mt-1 text-xs text-slate-600">{activeVideo.description}</p> : null}
              </div>
              <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close video" onClick={() => setActiveVideo(null)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MediaPage;
