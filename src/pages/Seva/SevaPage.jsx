import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import VolunteerForm from '../../components/forms/VolunteerForm';
import Card from '../../components/ui/Card';
import volunteerService from '../../services/volunteerService';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';

const formatDateLabel = (value) => {
  if (!value) {
    return 'Date TBD';
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};

const SevaPage = () => {
  const meta = useSeoMeta('Seva', 'Volunteer opportunities for langar, parking, teaching, and events.');
  const queryClient = useQueryClient();
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedSevaFilter, setSelectedSevaFilter] = useState('All');

  const { data: registrations = [] } = useQuery({
    queryKey: ['admin-volunteers'],
    queryFn: () => volunteerService.getApplications().then((res) => res.data)
  });

  const { data: sevaOpportunities = [] } = useQuery({
    queryKey: ['seva-opportunities'],
    queryFn: () => volunteerService.getSevaOpportunities().then((res) => res.data)
  });

  const onSubmit = async (payload) => {
    try {
      await volunteerService.apply(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-volunteers'] }),
        queryClient.invalidateQueries({ queryKey: ['volunteers-archive'] }),
        queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] })
      ]);
      setIsRegisterModalOpen(false);
      window.alert('Thank you for registering for seva.');
    } catch (error) {
      window.alert(error?.message || 'Unable to register for seva right now.');
    }
  };

  const filterOptions = useMemo(() => {
    const optionSet = new Set([
      ...sevaOpportunities.map((item) => item.sevaType).filter(Boolean),
      ...registrations.map((entry) => entry.sevaType || entry.area).filter(Boolean)
    ]);
    return ['All', ...Array.from(optionSet)];
  }, [registrations, sevaOpportunities]);

  const filteredRegistrations = useMemo(
    () => registrations.filter((entry) => selectedSevaFilter === 'All' || (entry.sevaType || entry.area) === selectedSevaFilter),
    [registrations, selectedSevaFilter]
  );

  const registrationsByOpportunity = useMemo(() => registrations.reduce((acc, entry) => {
    if (!entry.opportunityId) {
      return acc;
    }
    acc[entry.opportunityId] = (acc[entry.opportunityId] || 0) + 1;
    return acc;
  }, {}), [registrations]);

  const enrichedOpportunities = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return sevaOpportunities.map((item) => {
      const registered = registrationsByOpportunity[item.id] || 0;
      const totalRequired = Math.max(1, Number(item.totalVolunteersRequired) || 10);
      const isExpired = Boolean(item.expiryDate) && item.expiryDate < today;
      const isOpen = !isExpired && registered < totalRequired;

      return {
        ...item,
        registered,
        totalRequired,
        isExpired,
        isOpen
      };
    });
  }, [sevaOpportunities, registrationsByOpportunity]);

  const selectableOptions = useMemo(() => enrichedOpportunities
    .filter((item) => item.isOpen)
    .map((item) => ({
      id: item.id,
      label: `${item.sevaType} • ${formatDateLabel(item.date)}${item.time ? ` • ${item.time}` : ''} • ${item.registered}/${item.totalRequired}`
    })), [enrichedOpportunities]);

  const sevaTickerItems = useMemo(() => {
    if (enrichedOpportunities.length === 0) {
      return [];
    }
    return Array.from({ length: 6 }).flatMap(() => enrichedOpportunities);
  }, [enrichedOpportunities]);

  return (
    <div className="space-y-6">
      <Seo {...meta} />

      <section className="py-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-bold text-slate-900 md:text-5xl">Seva Opportunities</h1>
          <button type="button" onClick={() => setIsRegisterModalOpen(true)} disabled={selectableOptions.length === 0} className="rounded-xl bg-brand-blue px-5 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">Register for Seva</button>
        </div>
        <p className="mt-2 max-w-3xl text-slate-700">Join hands in langar, cleaning, parking, teaching, and event support.</p>
      </section>

      <section className="-mt-2">
        {sevaOpportunities.length === 0 ? (
          <Card><p className="text-sm text-slate-500">No seva opportunities available right now.</p></Card>
        ) : (
          <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-brand-blue/70 bg-brand-blue py-2.5">
            <div className="seva-ticker-track flex min-w-max items-center gap-8 whitespace-nowrap px-4 md:px-8">
              {sevaTickerItems.map((item, index) => (
                <p key={`${item.id}-${index}`} className="inline-flex items-center gap-2.5">
                  <span className="text-sm font-black text-white">{formatDateLabel(item.date)}</span>
                  <span className="text-base font-black text-white">{item.sevaType}</span>
                  <span className="text-base font-black text-brand-saffron">{item.time || 'Time TBD'}</span>
                  <span className="text-sm font-extrabold text-white/95">{item.registered}/{item.totalRequired} registered</span>
                  <span className={`text-sm font-extrabold ${item.isOpen ? 'text-emerald-300' : 'text-red-300'}`}>{item.isOpen ? 'Open' : 'Closed'}</span>
                  <span className="text-white/80">|</span>
                </p>
              ))}
            </div>
          </section>
        )}
      </section>

      <style>{`
        .seva-ticker-track {
          animation: sevaTickerFlow 115s linear infinite;
        }
        .seva-ticker-track:hover {
          animation-play-state: paused;
        }
        @keyframes sevaTickerFlow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <section>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Who is volunteering</p>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const isActive = option === selectedSevaFilter;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedSevaFilter(option)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${isActive ? 'bg-brand-saffron text-brand-navy shadow-sm' : 'bg-brand-cream text-brand-blue hover:bg-brand-saffron/30'}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <Card className="mt-5 rounded-none border-x-0 px-0 shadow-none hover:translate-y-0 hover:shadow-none">
          {filteredRegistrations.length === 0 ? (
            <p className="px-4 text-sm text-slate-500">No volunteers found for the selected seva filter.</p>
          ) : (
            <ul className="space-y-2 px-2">
              {filteredRegistrations.map((entry) => (
                <li key={entry.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">{entry.name}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{entry.sevaType || entry.area} • {entry.sevaDate || entry.date}{entry.sevaTime ? ` • ${entry.sevaTime}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {isRegisterModalOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Volunteer Registration</h3>
              <button type="button" onClick={() => setIsRegisterModalOpen(false)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4">
              <VolunteerForm onSubmit={onSubmit} options={selectableOptions} disableSubmit={selectableOptions.length === 0} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SevaPage;
