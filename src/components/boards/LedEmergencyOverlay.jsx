import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const LedEmergencyOverlay = ({ override }) => {
  if (!override?.active) return null;
  const end = override.endsAt ? new Date(override.endsAt) : null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center overflow-y-auto bg-red-950 px-6 py-10 text-center text-white sm:px-12" role="alert" aria-live="assertive">
      <div className="w-full max-w-6xl">
        <ExclamationTriangleIcon className="mx-auto h-24 w-24 text-amber-300 sm:h-32 sm:w-32" />
        <p className="mt-5 text-xl font-black uppercase tracking-[0.18em] text-amber-200 sm:text-3xl">Emergency Notice</p>
        <h1 className="mt-6 break-words text-5xl font-black leading-tight sm:text-7xl lg:text-8xl">{override.title}</h1>
        {override.details ? <p className="mx-auto mt-8 max-w-5xl whitespace-pre-wrap break-words text-2xl font-semibold leading-relaxed sm:text-4xl lg:text-5xl">{override.details}</p> : null}
        {end && !Number.isNaN(end.getTime()) ? <p className="mt-10 text-lg text-red-100 sm:text-2xl">This notice is scheduled to end at {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</p> : null}
      </div>
    </div>
  );
};

export default LedEmergencyOverlay;
