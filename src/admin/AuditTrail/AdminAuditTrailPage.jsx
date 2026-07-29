import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import auditService from '../../services/auditService';

const PAGE_SIZE = 20;

const AdminAuditTrailPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data: logs = [] } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => auditService.getLogs().then((res) => res.data)
  });

  const filtered = useMemo(() => {
    const needle = String(search || '').trim().toLowerCase();
    if (!needle) {
      return logs;
    }

    return logs.filter((entry) => {
      const haystack = [
        entry?.action,
        entry?.targetType,
        entry?.targetId,
        entry?.actorEmail,
        entry?.actorRole,
        entry?.actorName,
        entry?.description
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [logs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Card className="border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-slate-900">Admin Audit Trail</h2>
            <p className="text-xs text-slate-600">Track create, update, and delete operations made through the admin portal.</p>
          </div>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by action, target, or actor"
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </Card>

      <Card className="border border-slate-200 bg-white">
        <div className="hidden overflow-x-auto xl:block">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-xs text-slate-600">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{entry.action || '-'}</td>
                  <td className="px-3 py-2 text-slate-700">{entry.targetType || '-'} {entry.targetId ? `(${entry.targetId})` : ''}</td>
                  <td className="px-3 py-2 text-slate-700">{entry.actorName || entry.actorEmail || '-'}{entry.actorRole ? ` • ${entry.actorRole}` : ''}</td>
                  <td className="px-3 py-2 text-slate-700">{entry.description || '-'}</td>
                </tr>
              ))}
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">No audit entries found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 xl:hidden">
          {pagedRows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">No audit entries found.</div>
          ) : (
            pagedRows.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-xs text-slate-500">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{entry.action || '-'}</p>
                <p className="mt-1 text-xs text-slate-700">{entry.targetType || '-'} {entry.targetId ? `(${entry.targetId})` : ''}</p>
                <p className="mt-1 text-xs text-slate-700">{entry.actorName || entry.actorEmail || '-'}{entry.actorRole ? ` • ${entry.actorRole}` : ''}</p>
                <p className="mt-2 text-sm text-slate-700">{entry.description || '-'}</p>
              </article>
            ))
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {safePage} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage === totalPages}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminAuditTrailPage;
