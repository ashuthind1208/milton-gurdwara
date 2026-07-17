import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PencilSquareIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import userService from '../../services/userService';
import notificationService from '../../services/notificationService';

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected'];

const statusClassMap = {
  approved: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border border-amber-200 bg-amber-50 text-amber-700',
  rejected: 'border border-red-200 bg-red-50 text-red-700'
};

const actionIconClass = 'h-4 w-4';

const getAvatarUrl = (user = {}) => user.avatarUrl || user.picture || user.photoURL || '';

const userFormDefaults = {
  name: '',
  email: '',
  phone: '',
  address: '',
  role: 'Member'
};

const AdminUsersPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('All');
  const [viewUser, setViewUser] = useState(null);
  const [editUserId, setEditUserId] = useState('');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [approvalNotice, setApprovalNotice] = useState('');

  const form = useForm({ defaultValues: userFormDefaults });
  const editForm = useForm({ defaultValues: userFormDefaults });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => userService.getUsers().then((res) => res.data)
  });

  const createMutation = useMutation({
    mutationFn: (values) => userService.createUser({
      ...values,
      approvalStatus: values.role === 'Admin' || values.role === 'Super Admin' ? 'approved' : 'pending',
      isActive: true,
      registrationComplete: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      form.reset(userFormDefaults);
      setCreateUserOpen(false);
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

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => userService.updateUser(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }
  });

  const filteredUsers = useMemo(() => {
    if (activeFilter === 'All') {
      return users;
    }
    return users.filter((user) => String(user.approvalStatus || 'pending').toLowerCase() === activeFilter.toLowerCase());
  }, [activeFilter, users]);

  const familyJoinKpi = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const families = users.filter((entry) => String(entry.role || '').trim().toLowerCase() === 'family');

    let joinedThisMonth = 0;
    let joinedThisYear = 0;

    families.forEach((entry) => {
      const created = new Date(entry.createdAt || 0);
      if (Number.isNaN(created.getTime())) {
        return;
      }

      if (created.getFullYear() === year) {
        joinedThisYear += 1;
        if (created.getMonth() === month) {
          joinedThisMonth += 1;
        }
      }
    });

    return {
      totalFamilies: families.length,
      joinedThisMonth,
      joinedThisYear
    };
  }, [users]);

  const openEditUser = (user) => {
    setViewUser(null);
    setEditUserId(user.id);
    editForm.reset({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      role: user.role || 'Member'
    });
  };

  const openViewUser = (user) => {
    setEditUserId('');
    setViewUser(user);
  };

  const openCreateUser = () => {
    form.reset(userFormDefaults);
    setCreateUserOpen(true);
  };

  const closeModals = () => {
    setViewUser(null);
    setEditUserId('');
    setCreateUserOpen(false);
  };

  const renderActivePill = (user) => {
    const isActive = user.isActive !== false;

    return (
      <button
        type="button"
        onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !isActive })}
        disabled={toggleActiveMutation.isPending}
        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold transition ${isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300' : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400'} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {isActive ? 'Active' : 'Inactive'}
      </button>
    );
  };

  useEffect(() => {
    setHeaderAction(<AdminHeaderActionButton label="Add User" onClick={openCreateUser} />);

    return () => setHeaderAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderAction]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Users and Roles</h1>

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
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${activeFilter === filter ? 'bg-brand-blue text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-brand-blue/20 bg-blue-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Families Total</p>
            <p className="mt-1 text-2xl font-extrabold text-brand-blue">{familyJoinKpi.totalFamilies}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Families Joined This Month</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-700">{familyJoinKpi.joinedThisMonth}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Families Joined This Year</p>
            <p className="mt-1 text-2xl font-extrabold text-amber-700">{familyJoinKpi.joinedThisYear}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2.5">User</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Joined</th>
                <th className="px-3 py-2.5">Approval</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const approvalStatus = String(user.approvalStatus || 'pending').toLowerCase();
                const avatarUrl = getAvatarUrl(user);
                return (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5">
                      <div className="space-y-1.5 lg:hidden">
                        <div className="flex items-center gap-2">
                          <img
                            src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}`}
                            alt={user.name}
                            className="h-8 w-8 rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-sm font-bold leading-tight text-slate-800">{user.name}</span>
                        </div>
                        <p className="text-[12px] leading-snug text-slate-600">{user.email}</p>
                        <p className="text-[12px] leading-snug text-slate-600">{user.role || '-'}</p>
                        <p className="text-[12px] leading-snug text-slate-600">Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</p>
                        <p className="text-[12px] leading-snug text-slate-600">Approval: {approvalStatus}</p>
                        <div>{renderActivePill(user)}</div>
                      </div>
                      <div className="hidden lg:flex items-center gap-2">
                        <img
                          src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}`}
                          alt={user.name}
                          className="h-8 w-8 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className="font-medium text-slate-800">{user.name}</span>
                      </div>
                    </td>
                    <td className="admin-compact-mobile-hidden px-3 py-2.5 text-slate-700">{user.email}</td>
                    <td className="admin-compact-mobile-hidden px-3 py-2.5 text-slate-700">{user.role || '-'}</td>
                    <td className="admin-compact-mobile-hidden px-3 py-2.5 text-slate-700">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="admin-compact-mobile-hidden px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClassMap[approvalStatus] || statusClassMap.pending}`}>
                          {approvalStatus}
                        </span>
                        {approvalStatus !== 'approved' ? (
                          <button
                            type="button"
                            onClick={() => approvalMutation.mutate({ id: user.id, approvalStatus: 'approved' })}
                            disabled={approvalMutation.isPending}
                            className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="admin-compact-mobile-hidden px-3 py-2.5">{renderActivePill(user)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
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
                );
              })}

              {filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={7}>No users found for this tab.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {createUserOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeModals} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold">Add User</h3>
              <button type="button" onClick={closeModals} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close add user modal">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
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
              <label className="text-sm">Role
                <select {...form.register('role')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option>Family</option>
                  <option>Member</option>
                  <option>Volunteer</option>
                  <option>Admin</option>
                  <option>Super Admin</option>
                </select>
              </label>
              <div className="md:col-span-3 flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Adding...' : 'Add User'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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
              <p><span className="font-semibold">Avatar:</span> {getAvatarUrl(viewUser) || 'Not set'}</p>
              <p><span className="font-semibold">Name:</span> {viewUser.name || '-'}</p>
              <p><span className="font-semibold">Email:</span> {viewUser.email || '-'}</p>
              <p><span className="font-semibold">Phone:</span> {viewUser.phone || '-'}</p>
              <p><span className="font-semibold">Address:</span> {viewUser.address || '-'}</p>
              <p><span className="font-semibold">Role:</span> {viewUser.role || '-'}</p>
              <p><span className="font-semibold">Joined:</span> {viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleDateString() : '-'}</p>
              <p><span className="font-semibold">Approval:</span> {viewUser.approvalStatus || 'pending'}</p>
              <p><span className="font-semibold">Status:</span> {viewUser.isActive === false ? 'Inactive' : 'Active'}</p>
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
              <label className="text-sm">Role
                <select {...editForm.register('role')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option>Family</option>
                  <option>Member</option>
                  <option>Volunteer</option>
                  <option>Admin</option>
                  <option>Super Admin</option>
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
