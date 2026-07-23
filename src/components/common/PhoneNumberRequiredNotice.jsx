import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const PhoneNumberRequiredNotice = ({ activityLabel = 'this activity' }) => {
  return (
    <section
      role="alert"
      aria-live="polite"
      className="rounded-2xl border-2 border-red-300 bg-gradient-to-r from-red-50 via-white to-red-100 px-4 py-4 shadow-[0_12px_35px_-24px_rgba(185,28,28,0.65)] sm:px-6"
    >
      <div className="flex w-full items-start gap-3">
        <ExclamationTriangleIcon className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
        <div className="text-left">
          <p className="text-sm font-extrabold uppercase tracking-wide text-red-700 sm:text-base">
            Phone Number Required
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-red-800 sm:text-base">
            Add your phone number in your profile before performing {activityLabel}.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PhoneNumberRequiredNotice;
