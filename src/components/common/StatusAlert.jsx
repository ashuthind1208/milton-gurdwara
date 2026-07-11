import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

const StatusAlert = ({ type = 'success', message = '' }) => {
  if (!message) {
    return null;
  }

  const success = type === 'success';
  const Icon = success ? CheckCircleIcon : XCircleIcon;

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 shrink-0 ${success ? 'text-emerald-600' : 'text-red-600'}`} />
        <p className="font-medium">{message}</p>
      </div>
    </div>
  );
};

export default StatusAlert;
