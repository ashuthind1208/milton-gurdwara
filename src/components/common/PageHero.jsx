import { motion } from 'framer-motion';

const PageHero = ({ eyebrow, title, description, actions }) => {
  return (
    <section className="py-2">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-4xl">
        {eyebrow ? <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-blue">{eyebrow}</p> : null}
        <h1 className="font-heading text-3xl font-bold text-slate-900 md:text-5xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-slate-700">{description}</p>
        {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
      </motion.div>
    </section>
  );
};

export default PageHero;
