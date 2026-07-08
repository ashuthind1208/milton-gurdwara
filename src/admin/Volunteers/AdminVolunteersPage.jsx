import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import volunteerService from '../../services/volunteerService';

const AdminVolunteersPage = () => {
  const PAGE_SIZE = 6;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: applications = [] } = useQuery({
    queryKey: ['admin-volunteers'],
    queryFn: () => volunteerService.getApplications().then((res) => res.data)
  });

  const totalPages = Math.max(1, Math.ceil(applications.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return applications.slice(start, start + PAGE_SIZE);
  }, [applications, currentPage]);

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => volunteerService.updateApplication(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['volunteers-today'] });
      queryClient.invalidateQueries({ queryKey: ['volunteers-archive'] });
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Volunteer Management</h1>
      {applications.length > 0 ? (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, applications.length)} of {applications.length}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <p className="text-xs font-semibold text-slate-600">Page {currentPage} of {totalPages}</p>
            <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </Card>
      ) : null}
      <div className="space-y-3">
        {applications.length === 0 ? <Card><p className="text-sm text-slate-500">No volunteer applications yet.</p></Card> : paginatedApplications.map((item) => (
          <Card key={item.id} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{item.sevaType || item.area}</p>
              <p className="text-xs text-slate-500">Registered on {item.date}</p>
              <p className="mt-2 text-xs text-slate-500">Preferred contact: {item.contactPreference || 'Email'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.email ? <a href={`mailto:${item.email}`} className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white">Email</a> : null}
                {item.phone ? <a href={`tel:${item.phone}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Call</a> : null}
                {item.whatsapp ? <a href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-700">WhatsApp</a> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'Approved' ? 'bg-green-100 text-green-700' : item.status === 'Contacted' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {item.status}
              </span>
              <button type="button" onClick={() => updateMutation.mutate({ id: item.id, payload: { status: 'Contacted' } })} className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs text-white">Mark Contacted</button>
              <button type="button" onClick={() => updateMutation.mutate({ id: item.id, payload: { status: 'Approved' } })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700">Approve</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminVolunteersPage;
