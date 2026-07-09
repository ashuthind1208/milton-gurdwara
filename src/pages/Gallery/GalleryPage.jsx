import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageHero from '../../components/common/PageHero';
import GalleryCard from '../../components/cards/GalleryCard';
import galleryService from '../../services/galleryService';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import cmsService from '../../services/cmsService';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';

const GalleryPage = () => {
  const meta = useSeoMeta('Gallery', 'Photo and video albums with searchable highlights.');
  const location = useLocation();
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const { data: albums = [] } = useQuery({ queryKey: ['gallery-public'], queryFn: () => galleryService.getPublicAlbums().then((res) => res.data) });
  const { data: content } = useQuery({
    queryKey: ['page-content', 'gallery'],
    queryFn: () => cmsService.getPageContent('gallery').then((res) => res.data)
  });

  useEffect(() => {
    const openAlbumId = location.state?.openAlbumId;
    if (!openAlbumId || albums.length === 0) {
      return;
    }

    const targetAlbum = albums.find((album) => album.id === openAlbumId);
    if (targetAlbum) {
      setSelectedAlbum(targetAlbum);
    }
  }, [albums, location.state]);

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title={content?.heroTitle || 'Gallery'} description={content?.heroDescription || 'Browse albums of photos and videos from samagams, seva drives, and celebrations.'} />
      {content?.mediaUrl ? <img src={content.mediaUrl} alt="Gallery banner" className="h-56 w-full rounded-xl object-cover" loading="lazy" /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((album) => (
          <button key={album.id} type="button" className="text-left" onClick={() => setSelectedAlbum(album)}>
            <GalleryCard album={album} />
          </button>
        ))}
      </div>

      {selectedAlbum ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/55 px-3 py-4">
          <div className="w-full max-w-6xl rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl font-semibold text-slate-900">{selectedAlbum.title}</h3>
                <p className="text-xs text-slate-500">{selectedAlbum.eventDate || 'No date'} • {selectedAlbum.items} photos{selectedAlbum.folderUrl ? ' • Folder linked' : ''}</p>
                {selectedAlbum.description ? <p className="mt-1 text-xs text-slate-500">{selectedAlbum.description}</p> : null}
              </div>
              <button type="button" onClick={() => setSelectedAlbum(null)} className="rounded-md border border-slate-300 px-3 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4 max-h-[75vh] space-y-4 overflow-y-auto pr-1">
              {selectedAlbum.folderUrl ? (
                <div className="space-y-3">
                  {selectedAlbum.folderEmbedUrl ? (
                    <iframe
                      title={`${selectedAlbum.title} folder`}
                      src={selectedAlbum.folderEmbedUrl}
                      className="h-[70vh] w-full rounded-xl border border-slate-200"
                    />
                  ) : null}
                  {selectedAlbum.folderUrl ? (
                    <a href={selectedAlbum.folderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-brand-blue/30 px-3 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-blue/5">
                      <span>&gt;</span>
                      Open linked folder
                    </a>
                  ) : null}
                  {!selectedAlbum.folderEmbedUrl ? <p className="text-sm text-slate-500">Folder linked. Open it to view all images.</p> : null}
                </div>
              ) : (selectedAlbum.images || []).length > 0 ? (selectedAlbum.images || []).map((image) => (
                <figure key={image.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <img src={image.url} alt={image.caption || selectedAlbum.title} className="w-full object-contain" loading="lazy" onError={(event) => { event.currentTarget.src = gurdwaraLogo; }} />
                  {image.caption ? <figcaption className="px-3 py-2 text-xs text-slate-600">{image.caption}</figcaption> : null}
                </figure>
              )) : <p className="text-sm text-slate-500">No photos found in this folder.</p>}

              {(selectedAlbum.images || []).length > 0 && selectedAlbum.folderUrl ? (
                <div className="pt-2">
                  <a href={selectedAlbum.folderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-brand-blue/30 px-3 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-blue/5">
                    <span>&gt;</span>
                    Open source folder
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GalleryPage;
