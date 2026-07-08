const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-4">
    <h2 className="font-heading text-2xl font-bold text-slate-900 md:text-3xl">{title}</h2>
    {subtitle ? <p className="mt-1.5 text-slate-600">{subtitle}</p> : null}
  </div>
);

export default SectionTitle;
