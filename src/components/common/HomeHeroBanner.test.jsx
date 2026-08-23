import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import HomeHeroBanner from './HomeHeroBanner';

test('advances to the next hero slide when the active upload is missing', () => {
  render(
    <BrowserRouter>
      <HomeHeroBanner
        content={{
          slides: [
            { title: 'Missing hero', image: '/api/uploads/cms/missing.png' },
            { title: 'Available hero', image: '/api/uploads/cms/available.jpg' }
          ]
        }}
      />
    </BrowserRouter>
  );

  const missingImage = screen.getByAltText('Missing hero');
  expect(missingImage).toHaveClass('block');
  expect(missingImage).toHaveClass('md:absolute');
  expect(missingImage).toHaveStyle({ display: 'none' });
  fireEvent.error(missingImage);

  expect(screen.queryByAltText('Missing hero')).not.toBeInTheDocument();
  const availableImage = screen.getByAltText('Available hero');
  expect(availableImage).toHaveClass('block');
  expect(availableImage).toHaveClass('md:opacity-80');
  expect(availableImage).toHaveAttribute('loading', 'eager');
  expect(availableImage).toHaveStyle({ display: 'none' });
  fireEvent.load(availableImage);
  expect(availableImage).toHaveStyle({ display: 'block' });
  expect(screen.queryByRole('button', { name: 'Show slide 1' })).not.toBeInTheDocument();
  expect(availableImage.nextElementSibling).toHaveClass('bg-black/70');
  expect(availableImage.nextElementSibling).not.toHaveClass('hidden');
});