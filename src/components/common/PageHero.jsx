const PageHero = ({ eyebrow, title, description, titleActions, inlineTitleActions = false, actions, containerClassName = 'max-w-5xl' }) => {
  return (
    <section className="py-2">
      <div className={containerClassName}>
        {eyebrow ? <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-blue">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="font-heading text-3xl font-bold text-slate-900 md:text-5xl">{title}</h1>
          {titleActions ? <div className={inlineTitleActions ? 'flex-none pt-1 md:pt-2' : 'w-full min-w-0 pt-1 sm:ml-auto sm:w-auto sm:flex-none'}>{titleActions}</div> : null}
        </div>
        {description ? <p className="mt-3 max-w-3xl text-slate-700">{description}</p> : null}
        {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
};

export default PageHero;
