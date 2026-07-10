import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const fallbackContent = {
  eyebrow: 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh',
  title: 'Gurdwara Singh Sabha Milton',
  description: 'Daily hukamnama, samagams, seva, and community support in one place.',
  slides: [
    {
      image:
        'https://assets.cdn.filesafe.space/b9aAKZlXnebGhQoRLosa/media/654583d092b8570d5a8c5f1a.png',
      eyebrow: 'Weekly Diwan',
      title: 'Sunday Samagam',
      description: 'Sukhmani Sahib, Kirtan, Katha, and Ardaas with Langar sewa',
      primaryCtaLabel: 'View Sunday Program',
      primaryCtaPath: '/events',
      secondaryCtaLabel: 'Register for Seva',
      secondaryCtaPath: '/seva',
      contentLinkLabel: 'Read daily hukamnama',
      contentLinkPath: '/hukamnama'
    }
  ]
};

const HomeHeroBanner = ({ content, actions, topRightSlot, onSlideAction }) => {
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';
  const resolvedContent = content || fallbackContent;
  const slides = useMemo(() => resolvedContent.slides || [], [resolvedContent]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= slides.length && slides.length > 0) {
      setIndex(0);
    }
  }, [index, slides.length]);

  const activeSlide = slides[index] || {};
  const activeEyebrow = activeSlide.eyebrow || resolvedContent.eyebrow;
  const activeTitle = activeSlide.title || activeSlide.heading || resolvedContent.title;
  const activeDescription = activeSlide.description || activeSlide.caption || resolvedContent.description;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-brand-blue/20 shadow-soft">
      <img
        src={activeSlide.image}
        alt={activeSlide.heading || 'Hero slide'}
        className="h-[360px] w-full object-cover opacity-35 md:h-[440px]"
        loading="eager"
        decoding="async"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-blue/78 to-brand-blue/62" />

      {topRightSlot ? (
        <div className="absolute right-4 top-4 z-10 w-[220px] max-w-[calc(100%-2rem)] md:right-6 md:top-6 md:w-[260px]">
          {topRightSlot}
        </div>
      ) : null}

      <div className="absolute inset-0 flex flex-col justify-center p-6 pt-24 text-white md:p-10 md:pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-saffron">{activeEyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-bold leading-tight md:text-5xl">{activeTitle}</h1>
        <p className="mt-3 max-w-3xl text-sm text-blue-50 md:text-base">{activeDescription}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {activeSlide.primaryCtaLabel && activeSlide.primaryCtaPath ? (
            <button
              type="button"
              onClick={() => onSlideAction?.(activeSlide.primaryCtaPath)}
              className="inline-flex items-center justify-center rounded-xl bg-brand-saffron px-5 py-2.5 font-medium text-slate-900 transition hover:bg-amber-400"
            >
              {activeSlide.primaryCtaLabel}
            </button>
          ) : null}
          {activeSlide.secondaryCtaLabel && activeSlide.secondaryCtaPath ? (
            <button
              type="button"
              onClick={() => onSlideAction?.(activeSlide.secondaryCtaPath)}
              className="inline-flex items-center justify-center rounded-xl border border-white/70 bg-transparent px-5 py-2.5 font-medium text-white transition hover:bg-white/10"
            >
              {activeSlide.secondaryCtaLabel}
            </button>
          ) : actions}
        </div>
        {(activeSlide.contentLinkLabel && activeSlide.contentLinkPath) || (activeSlide.contentLinkTwoLabel && activeSlide.contentLinkTwoPath) ? (
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-blue-50">
            {activeSlide.contentLinkLabel && activeSlide.contentLinkPath ? (
              <button type="button" onClick={() => onSlideAction?.(activeSlide.contentLinkPath)} className="underline underline-offset-4">
                {activeSlide.contentLinkLabel}
              </button>
            ) : null}
            {activeSlide.contentLinkTwoLabel && activeSlide.contentLinkTwoPath ? (
              <button type="button" onClick={() => onSlideAction?.(activeSlide.contentLinkTwoPath)} className="underline underline-offset-4">
                {activeSlide.contentLinkTwoLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isHomeRoute && slides.length > 1 ? (
        <div className="absolute bottom-5 right-5 z-10 flex gap-2 md:bottom-6 md:right-6">
          {slides.map((slide, dotIndex) => (
            <button
              key={`${slide.title || slide.heading}-${dotIndex}`}
              onClick={() => setIndex(dotIndex)}
              className={`h-2.5 rounded-full transition ${
                dotIndex === index ? 'w-7 bg-brand-saffron' : 'w-2.5 bg-white/65'
              }`}
              aria-label={`Show slide ${dotIndex + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default HomeHeroBanner;
