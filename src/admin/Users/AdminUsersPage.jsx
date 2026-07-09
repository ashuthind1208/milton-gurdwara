import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, XMarkIcon, TrashIcon, EyeIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import userService from '../../services/userService';
import notificationService from '../../services/notificationService';

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected'];

const statusClassMap = {
  approved: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border border-amber-200 bg-amber-50 text-amber-700',
  rejected: 'border border-red-200 bg-red-50 text-red-700'
};

const actionIconClass = 'h-4 w-4';

const AdminUsersPage = () => {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('All');
  const [viewUser, setViewUser] = useState(null);
  const [editUserId, setEditUserId] = useState('');
  const [approvalNotice, setApprovalNotice] = useState('');
  const form = useForm({ defaultValues: { name: '', role: 'Editor', email: '', phone: '', address: '', memberType: 'Member' } });
  const editForm = useForm({ defaultValues: { name: '', role: 'Editor', email: '', phone: '', address: '', memberType: 'Member' } });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => userService.getUsers().then((res) => res.data) });

  const createMutation = useMutation({
    mutationFn: (values) => userService.createUser(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      form.reset({ name: '', role: 'Editor', email: '', phone: '', address: '', memberType: 'Member' });
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id) => userService.removeUser(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setViewUser((prev) => (prev?.id === deletedId ? null : prev));
      if (editUserId === deletedId) {
        setEditUserId('');
      }
    }
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ id, approvalStatus }) => {
      const response = await userService.updateApprovalStatus(id, approvalStatus);
      return { approvalStatus, user: response.data };
    },
    onSuccess: async ({ approvalStatus, user }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

      if (approvalStatus !== 'approved') {
        setApprovalNotice('');
        return;
      }

      const emailResult = await notificationService.sendApprovalEmail(user).then((res) => res.data);
      if (emailResult?.sent) {
        setApprovalNotice(`Approval email sent to ${user?.email}.`);
      } else {
        setApprovalNotice('User approved. Email webhook is not configured or failed.');
      }
    }
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }) => userService.updateUser(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUserId('');
      setViewUser(null);
    }
  });

  const filteredUsers = useMemo(() => {
    if (activeFilter === 'All') {
      return users;
    }
    return users.filter((user) => String(user.approvalStatus || 'pending').toLowerCase() === activeFilter.toLowerCase());
  }, [activeFilter, users]);

  const openEditUser = (user) => {
    setViewUser(null);
    setEditUserId(user.id);
    editForm.reset({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      memberType: user.memberType || 'Member',
      role: user.role || 'Editor'
    });
  };

  const openViewUser = (user) => {
    setEditUserId('');
    setViewUser(user);
  };

  const closeModals = () => {
    setViewUser(null);
    setEditUserId('');
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Users and Roles</h1>
      <Card>
        <h2 className="font-heading text-xl font-semibold">Add User</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
          <label className="text-sm">Name
            <input {...form.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Email
            <input type="email" {...form.register('email', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Phone
            <input {...form.register('phone')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm md:col-span-2">Address
            <input {...form.register('address')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Member Type
            <select {...form.register('memberType')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
              <option>Member</option>
              <option>Volunteer</option>
              <option>Admin</option>
            </select>
          </label>
          <label className="text-sm">Role
            <select {...form.register('role')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
              <option>Super Admin</option>
              <option>Editor</option>
              <option>Finance</option>
              <option>Volunteer Coordinator</option>
            </select>
          </label>
          <div className="md:col-span-3">
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Adding...' : 'Add User'}</Button>
          </div>
        </form>
      </Card>
      <Card>
        {approvalNotice ? (
          <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{approvalNotice}</p>
        ) : null}
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${activeFilter === filter ? 'bg-brand-blue text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Approval</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}`} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                      <span className="font-semibold text-slate-800">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">{user.email}</td>
                  <td className="py-2 pr-3">{user.memberType || '-'}</td>
                  <td className="py-2 pr-3">{user.role || '-'}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClassMap[user.approvalStatus || 'pending'] || statusClassMap.pending}`}>
                      {user.approvalStatus || 'pending'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openViewUser(user)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100"
                        aria-label="View user"
                        title="View"
                      >
                        <EyeIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditUser(user)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 text-blue-700 transition hover:bg-blue-50"
                        aria-label="Edit user"
                        title="Edit"
                      >
                        <PencilSquareIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        disabled={approvalMutation.isPending || user.approvalStatus === 'approved'}
                        onClick={() => approvalMutation.mutate({ id: user.id, approvalStatus: 'approved' })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40"
                        aria-label="Approve user"
                        title="Approve"
                      >
                        <CheckIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        disabled={approvalMutation.isPending || user.approvalStatus === 'rejected'}
                        onClick={() => approvalMutation.mutate({ id: user.id, approvalStatus: 'rejected' })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-amber-700 transition hover:bg-amber-50 disabled:opacity-40"
                        aria-label="Reject user"
                        title="Reject"
                      >
                        <XMarkIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(user.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50"
                        aria-label="Delete user"
                        title="Delete"
                      >
                        <TrashIcon className={actionIconClass} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={6}>No users found for this tab.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      {viewUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeModals} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-semibold">User Details</h3>
                <p className="text-xs text-slate-500">Quick profile preview</p>
              </div>
              <button type="button" onClick={closeModals} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close view modal">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p><span className="font-semibold">Name:</span> {viewUser.name || '-'}</p>
              <p><span className="font-semibold">Email:</span> {viewUser.email || '-'}</p>
              <p><span className="font-semibold">Phone:</span> {viewUser.phone || '-'}</p>
              <p><span className="font-semibold">Address:</span> {viewUser.address || '-'}</p>
              <p><span className="font-semibold">Member Type:</span> {viewUser.memberType || '-'}</p>
              <p><span className="font-semibold">Role:</span> {viewUser.role || '-'}</p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" variant="ghost" onClick={closeModals}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
      {editUserId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeModals} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold">Edit User</h3>
              <button type="button" onClick={closeModals} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close edit modal">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={editForm.handleSubmit((values) => editMutation.mutate({ id: editUserId, values }))}>
              <label className="text-sm">Name
                <input {...editForm.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Email
                <input type="email" {...editForm.register('email', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Phone
                <input {...editForm.register('phone')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Address
                <input {...editForm.register('address')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Member Type
                <select {...editForm.register('memberType')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option>Member</option>
                  <option>Volunteer</option>
                  <option>Admin</option>
                </select>
              </label>
              <label className="text-sm">Role
                <select {...editForm.register('role')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option>Super Admin</option>
                  <option>Editor</option>
                  <option>Finance</option>
                  <option>Volunteer Coordinator</option>
                </select>
              </label>
              <div className="md:col-span-3 flex gap-2">
                <Button type="submit" disabled={editMutation.isPending}>{editMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminUsersPage;
