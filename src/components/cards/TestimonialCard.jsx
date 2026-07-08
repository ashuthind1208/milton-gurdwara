import Card from '../ui/Card';

const TestimonialCard = ({ quote, name }) => (
  <Card>
    <p className="text-slate-700 dark:text-slate-200">"{quote}"</p>
    <p className="mt-4 font-semibold text-brand-blue">{name}</p>
  </Card>
);

export default TestimonialCard;
