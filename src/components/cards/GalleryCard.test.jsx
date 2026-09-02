import { render, screen } from '@testing-library/react';
import GalleryCard from './GalleryCard';

test('opens an external gallery folder in a new tab', () => {
  render(
    <GalleryCard
      album={{
        title: 'Community Event',
        folderUrl: 'https://drive.google.com/drive/folders/example',
        frontImage: 'https://example.com/cover.jpg',
        images: [],
        items: 0
      }}
    />
  );

  const folderLink = screen.getByRole('link', { name: 'Open Community Event folder in a new tab' });

  expect(folderLink).toHaveAttribute('href', 'https://drive.google.com/drive/folders/example');
  expect(folderLink).toHaveAttribute('target', '_blank');
  expect(folderLink).toHaveAttribute('rel', 'noreferrer');
  expect(folderLink).toContainElement(screen.getByText('Community Event'));
  expect(screen.getByAltText('Community Event')).toBeInTheDocument();
  expect(screen.queryByText(/image links/i)).not.toBeInTheDocument();
});
