import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import VolunteerForm from '../../components/forms/VolunteerForm';
import Card from '../../components/ui/Card';
import volunteerService from '../../services/volunteerService';
import advertisementService from '../../services/advertisementService';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import { useAuth } from '../../context/AuthContext';
import contentApiService from '../../services/contentApiService';

const SEVA_IDENTITY_SETTING_KEY = 'settings-seva-allow-custom-name-email';

const formatDateLabel = (value) => {
  if (!value) {
    return 'Date TBD';
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatShortDate = (value) => {
  if (!value) {
    return 'TBD';
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

const SevaPage = () => {
  const meta = useSeoMeta('Seva', 'Volunteer opportunities for langar, parking, teaching, and events.');
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [volunteerModalOpportunityId, setVolunteerModalOpportunityId] = useState('');
  const { data: sevaIdentitySettings = { enabled: false } } = useQuery({
    queryKey: [SEVA_IDENTITY_SETTING_KEY],
    queryFn: () => contentApiService.getSingleton(SEVA_IDENTITY_SETTING_KEY, { enabled: false })
  });
  const profilePhoneMissing = !String(user?.phone || '').trim();
  const currentUserEmail = String(user?.email || '').trim().toLowerCase();
  const currentUserPhone = String(user?.phone || '').trim().toLowerCase();
  const currentUserName = String(user?.name || '').trim().toLowerCase();

  const { data: registrations = [] } = useQuery({
    queryKey: ['admin-volunteers'],
    queryFn: () => volunteerService.getApplications().then((res) => res.data)
  });

  const { data: sevaOpportunities = [] } = useQuery({
    queryKey: ['seva-opportunities'],
    queryFn: () => volunteerService.getSevaOpportunities().then((res) => res.data)
  });

  const { data: ads = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((res) => res.data)
  });

  const sevaTopAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Seva Top Banner').slice(0, 2), [ads]);
  const sevaFooterAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Seva Footer Banner').slice(0, 2), [ads]);

  const onSubmit = async (payload) => {
    if (!isAuthenticated) {
      window.alert('Please sign in before registering for seva.');
      return;
    }
    if (profilePhoneMissing) {
      window.alert('Please add your phone number in profile before registering for seva.');
      return;
    }

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
      const isExpired = Boolean(item.isClosed) || (Boolean(item.expiryDate) && item.expiryDate < today);
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

  const sevaStats = useMemo(() => {
    if (enrichedOpportunities.length === 0) {
      return {
        totalOpenOpportunities: 0,
        totalVolunteersNeeded: 0,
        totalRegistered: 0,
        totalOpenSpots: 0,
        nextSevaDate: ''
      };
    }

    const totalOpenOpportunities = enrichedOpportunities.filter((item) => item.isOpen).length;
    const totalVolunteersNeeded = enrichedOpportunities.reduce((sum, item) => sum + item.totalRequired, 0);
    const totalRegistered = enrichedOpportunities.reduce((sum, item) => sum + item.registered, 0);
    const totalOpenSpots = Math.max(0, totalVolunteersNeeded - totalRegistered);
    const nextOpen = enrichedOpportunities
      .filter((item) => item.isOpen)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];

    return {
      totalOpenOpportunities,
      totalVolunteersNeeded,
      totalRegistered,
      totalOpenSpots,
      nextSevaDate: nextOpen?.date || ''
    };
  }, [enrichedOpportunities]);

  const volunteerRowsByOpportunity = useMemo(() => {
    const rowsById = {};
    enrichedOpportunities.forEach((opportunity) => {
      rowsById[opportunity.id] = registrations.filter((entry) => (
        entry.opportunityId === opportunity.id
        || (
          !entry.opportunityId
          && (entry.sevaType || entry.area) === opportunity.sevaType
          && (entry.sevaDate || entry.date) === opportunity.date
        )
      ));
    });
    return rowsById;
  }, [enrichedOpportunities, registrations]);

  const activeVolunteerOpportunity = useMemo(
    () => enrichedOpportunities.find((item) => item.id === volunteerModalOpportunityId) || null,
    [enrichedOpportunities, volunteerModalOpportunityId]
  );

  const activeVolunteerRows = useMemo(
    () => (volunteerModalOpportunityId ? (volunteerRowsByOpportunity[volunteerModalOpportunityId] || []) : []),
    [volunteerModalOpportunityId, volunteerRowsByOpportunity]
  );

  const selectableOptions = useMemo(() => enrichedOpportunities
    .filter((item) => item.isOpen)
    .map((item) => {
      const existingRows = volunteerRowsByOpportunity[item.id] || [];
      const alreadyRegistered = existingRows.some((entry) => {
        const entryEmail = String(entry.email || '').trim().toLowerCase();
        const entryPhone = String(entry.phone || entry.whatsapp || '').trim().toLowerCase();
        const entryName = String(entry.name || '').trim().toLowerCase();
        return (currentUserEmail && entryEmail === currentUserEmail)
          || (currentUserPhone && entryPhone === currentUserPhone)
          || (currentUserName && entryName === currentUserName);
      });

      return {
        id: item.id,
        label: `${item.sevaType} • ${formatDateLabel(item.date)}${item.time ? ` • ${item.time}` : ''} • ${item.registered}/${item.totalRequired}${alreadyRegistered ? ' • Already registered' : ''}`,
        disabled: alreadyRegistered,
        alreadyRegistered
      };
    }), [currentUserEmail, currentUserName, currentUserPhone, enrichedOpportunities, volunteerRowsByOpportunity]);

  const sevaTickerItems = useMemo(() => {
    if (enrichedOpportunities.length === 0) {
      return [];
    }
    return enrichedOpportunities.slice(0, 12);
  }, [enrichedOpportunities]);

  return (
    <div className="space-y-6">
      <Seo {...meta} />

      <section className="py-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-bold text-slate-900 md:text-5xl">Seva Opportunities</h1>
        </div>
        <p className="mt-2 max-w-3xl text-slate-700">Join hands in langar, cleaning, parking, teaching, and event support.</p>
      </section>

      <section className="-mt-2">
        {sevaOpportunities.length === 0 ? (
          <Card><p className="text-sm text-slate-500">No seva opportunities available right now.</p></Card>
        ) : (
          <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-brand-blue/70 bg-brand-blue py-2.5">
            <div className="ticker-mask px-4 md:px-8">
              <div className="ticker-track ticker-speed-medium ticker-no-pause">
                {[0, 1].map((groupIndex) => (
                  <div key={`seva-group-${groupIndex}`} className="ticker-group">
                    {sevaTickerItems.map((item) => (
                      <p key={`${groupIndex}-${item.id}`} className="inline-flex shrink-0 items-center gap-2.5 pr-8">
                        <span className="text-sm font-black text-white">{formatDateLabel(item.date)}</span>
                        <span className="text-base font-black text-white">{item.sevaType}</span>
                        <span className="text-base font-black text-brand-saffron">{item.time || 'Time TBD'}</span>
                        <span className="text-sm font-extrabold text-white/95">{item.registered}/{item.totalRequired} registered</span>
                        <span className={`text-sm font-extrabold ${item.isOpen ? 'text-emerald-300' : 'text-red-300'}`}>{item.isOpen ? 'Open' : 'Closed'}</span>
                        <span className="text-white/80">|</span>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </section>

      {sevaTopAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {sevaTopAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.website || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (ad.website) {
                    void advertisementService.recordAdClick(ad.id);
                  }
                }}
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-brand-blue/20 bg-gradient-to-br from-blue-50 to-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Open Opportunities</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{sevaStats.totalOpenOpportunities}</p>
          <p className="mt-1 text-xs text-slate-600">Currently accepting volunteer registrations.</p>
        </Card>
        <Card className="border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Registered Sevadars</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{sevaStats.totalRegistered}</p>
          <p className="mt-1 text-xs text-slate-600">Across all listed seva sessions.</p>
        </Card>
        <Card className="border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Open Spots</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{sevaStats.totalOpenSpots}</p>
          <p className="mt-1 text-xs text-slate-600">Remaining places for the next seva cycles.</p>
        </Card>
        <Card className="border border-violet-200/70 bg-gradient-to-br from-violet-50 to-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Next Seva Date</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatShortDate(sevaStats.nextSevaDate)}</p>
          <p className="mt-1 text-xs text-slate-600">Upcoming open seva opportunity.</p>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-900">Seva Readiness & Opportunity Details</h2>
            <p className="text-sm text-slate-600">Live session-wise progress, availability, and volunteer visibility in one place.</p>
          </div>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                if (profilePhoneMissing) {
                  window.alert('Please add your phone number in profile before registering for seva.');
                  return;
                }
                setIsRegisterModalOpen(true);
              }}
              disabled={selectableOptions.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-blue via-blue-600 to-brand-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:from-amber-200 hover:via-amber-300 hover:to-brand-saffron hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              Register for Seva
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {!isAuthenticated ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Please <Link to="/login?next=/seva" className="font-bold underline">sign in</Link> to register for seva opportunities.
          </p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {enrichedOpportunities.map((item) => {
            const remaining = Math.max(0, item.totalRequired - item.registered);
            const fillPercent = Math.min(100, Math.round((item.registered / item.totalRequired) * 100));
            const volunteerCount = volunteerRowsByOpportunity[item.id]?.length || 0;
            return (
              <Card key={item.id} className="border border-slate-200 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{item.sevaType}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${item.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                    {item.isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{formatDateLabel(item.date)} • {item.time || 'Time TBD'}</p>
                <p className="mt-1 text-xs text-slate-500">Registration closes: {formatDateLabel(item.expiryDate)}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-blue" style={{ width: `${fillPercent}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-700">
                  <span>{item.registered}/{item.totalRequired} registered</span>
                  <span>{remaining} spots left</span>
                </div>
                <button
                  type="button"
                  className="mt-3 inline-flex rounded-lg border border-brand-blue/25 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-brand-blue hover:border-brand-blue/45"
                  onClick={() => setVolunteerModalOpportunityId(item.id)}
                >
                  View Volunteers ({volunteerCount})
                </button>
              </Card>
            );
          })}
        </div>
      </section>

      {sevaFooterAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {sevaFooterAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.website || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (ad.website) {
                    void advertisementService.recordAdClick(ad.id);
                  }
                }}
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {activeVolunteerOpportunity ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-4xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl font-semibold">Volunteers • {activeVolunteerOpportunity.sevaType}</h3>
                <p className="text-xs text-slate-600">{formatDateLabel(activeVolunteerOpportunity.date)}{activeVolunteerOpportunity.time ? ` • ${activeVolunteerOpportunity.time}` : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => setVolunteerModalOpportunityId('')}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activeVolunteerRows.length > 0 ? (
                    activeVolunteerRows.map((entry) => (
                      <tr key={entry.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-800">{entry.name || '-'}</td>
                        <td className="px-3 py-2 text-slate-700">{entry.sevaType || entry.area || activeVolunteerOpportunity.sevaType}</td>
                        <td className="px-3 py-2 text-slate-700">{entry.sevaDate || entry.date || '-'}</td>
                        <td className="px-3 py-2 text-slate-700">{entry.sevaTime || activeVolunteerOpportunity.time || 'TBD'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-500">No volunteers registered yet for this seva opportunity.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {isAuthenticated && isRegisterModalOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Volunteer Registration</h3>
              <button type="button" onClick={() => setIsRegisterModalOpen(false)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4">
              <VolunteerForm
                onSubmit={onSubmit}
                options={selectableOptions}
                disableSubmit={selectableOptions.length === 0}
                allowNameEmailEdit={Boolean(sevaIdentitySettings?.enabled)}
                initialValues={{
                  name: user?.name || '',
                  email: user?.email || '',
                  phone: user?.phone || ''
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SevaPage;
