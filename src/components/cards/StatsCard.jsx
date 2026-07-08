import Card from '../ui/Card';

const StatsCard = ({ label, value, tone = 'text-brand-blue' }) => (
  <Card>
    <p className="text-sm text-slate-500 dark:text-slate-300">{label}</p>
    <p className={`mt-2 font-heading text-3xl font-bold ${tone}`}>{value}</p>
  </Card>
);

export default StatsCard;
