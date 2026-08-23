import { useState } from 'react';
import Card from '../ui/Card';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';

const GalleryCard = ({ album }) => {
  const [imageSrc, setImageSrc] = useState(album.frontImage || album.cover || gurdwaraLogo);
  const previewCaption = album.images?.[0]?.caption;

  return (
    <Card className="overflow-hidden p-0">
      {album.folderUrl ? (
        <a href={album.folderUrl} aria-label={`Open ${album.title} folder`} className="block">
          <img src={imageSrc} alt={album.title} className="h-40 w-full object-cover" loading="lazy" onError={() => setImageSrc(gurdwaraLogo)} />
        </a>
      ) : (
        <img src={imageSrc} alt={album.title} className="h-40 w-full object-cover" loading="lazy" onError={() => setImageSrc(gurdwaraLogo)} />
      )}
      <div className="p-4">
        <h3 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">{album.title}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{album.items} image links{album.eventDate ? ` • ${album.eventDate}` : ''}</p>
        {album.description ? <p className="mt-2 text-xs text-slate-500 line-clamp-2">{album.description}</p> : previewCaption ? <p className="mt-2 text-xs text-slate-500">{previewCaption}</p> : <p className="mt-2 text-xs text-slate-500">No description added yet.</p>}
      </div>
    </Card>
  );
};

export default GalleryCard;
