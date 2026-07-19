const PageHero = ({ eyebrow, title, description, titleActions, actions, containerClassName = 'max-w-5xl' }) => {
  return (
    <section className="py-2">
      <div className={containerClassName}>
        {eyebrow ? <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-blue">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="font-heading text-3xl font-bold text-slate-900 md:text-5xl">{title}</h1>
          {titleActions ? <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 pt-1">{titleActions}</div> : null}
        </div>
        {description ? <p className="mt-3 max-w-3xl text-slate-700">{description}</p> : null}
        {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
};

export default PageHero;
