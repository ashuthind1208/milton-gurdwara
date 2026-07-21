import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PencilSquareIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import { adminNav } from '../../constants/navigation';
import { useAuth } from '../../context/AuthContext';
import contentApiService from '../../services/contentApiService';
import userService from '../../services/userService';
import notificationService from '../../services/notificationService';
import uploadService from '../../services/uploadService';

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected'];

const statusClassMap = {
  approved: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border border-amber-200 bg-amber-50 text-amber-700',
  rejected: 'border border-red-200 bg-red-50 text-red-700'
};

const activeStatusClassMap = {
  active: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  inactive: 'border border-slate-200 bg-slate-100 text-slate-700'
};

const actionIconClass = 'h-4 w-4';
const STANDARD_ROLES = ['Family', 'Member', 'Volunteer', 'Admin', 'Super Admin'];
const CUSTOM_ROLE_RESOURCE = 'admin_roles';
const adminPageOptions = adminNav.map((item) => ({ label: item.label, path: item.path }));
const memberAllowedAdminPagePaths = [
  '/admin',
  '/admin/hukamnama',
  '/admin/seva-opportunities',
  '/admin/gallery',
  '/admin/library',
  '/admin/videos',
  '/admin/streaming',
  '/admin/events'
];
const volunteerAllowedAdminPagePaths = [
  '/admin',
  '/admin/seva-opportunities',
  '/admin/gallery',
  '/admin/videos',
  '/admin/events'
];

const normalizeAdminPageAccess = (value = []) => {
  const normalized = Array.isArray(value) ? value.map((path) => String(path || '').trim()).filter(Boolean) : [];
  return [...new Set(normalized.filter((path) => adminPageOptions.some((item) => item.path === path)))];
};

const getDefaultAdminPageAccess = (user = {}) => {
  const storedAccess = normalizeAdminPageAccess(user.adminPageAccess);
  if (storedAccess.length > 0) {
    return storedAccess;
  }

  const role = String(user.role || '').trim().toLowerCase();
  if (role === 'admin' || role === 'super admin') {
    return adminPageOptions.map((item) => item.path);
  }

  if (role === 'member') {
    return memberAllowedAdminPagePaths;
  }

  if (role === 'volunteer') {
    return volunteerAllowedAdminPagePaths;
  }

  return [];
};

const isStandardRole = (role) => STANDARD_ROLES.includes(role);

const normalizeRoleDefinitions = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  return value
    .map((entry) => ({
      name: String(entry?.name || '').trim(),
      adminPageAccess: normalizeAdminPageAccess(entry?.adminPageAccess)
    }))
    .filter((entry) => entry.name && !isStandardRole(entry.name) && !seen.has(entry.name) && seen.add(entry.name));
};

const getAvatarSrc = (user = {}) => (
  getAvatarUrl(user) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}`
);

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
  const { user: currentUser, persistUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('All');
  const [viewUser, setViewUser] = useState(null);
  const [editUserId, setEditUserId] = useState('');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [approvalNotice, setApprovalNotice] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isEditImageUploading, setIsEditImageUploading] = useState(false);
  const [editImageUploadProgress, setEditImageUploadProgress] = useState(0);
  const [editImageUploadError, setEditImageUploadError] = useState('');

  const form = useForm({ defaultValues: userFormDefaults });
  const editForm = useForm({ defaultValues: userFormDefaults });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => userService.getUsers().then((res) => res.data)
  });
  const { data: customRoleDefinitions = [] } = useQuery({
    queryKey: ['admin-role-definitions'],
    queryFn: () => contentApiService.getSingleton(CUSTOM_ROLE_RESOURCE, []).then((res) => normalizeRoleDefinitions(res || []))
  });
  const [desktopSearchTerm, setDesktopSearchTerm] = useState('');
  const [mobileSearchTerm, setMobileSearchTerm] = useState('');
  const [mobilePage, setMobilePage] = useState(1);
  const mobilePageSize = 10;
  const roleOptions = useMemo(
    () => [...new Set([...STANDARD_ROLES, ...customRoleDefinitions.map((entry) => entry.name)])],
    [customRoleDefinitions]
  );

  const getCustomRoleAccessByName = (roleName) => {
    const role = customRoleDefinitions.find((entry) => entry.name === String(roleName || '').trim());
    return role ? normalizeAdminPageAccess(role.adminPageAccess) : undefined;
  };

  const createMutation = useMutation({
    mutationFn: (values) => {
      const resolvedRole = String(values.role || '').trim() || 'Member';
      const customRoleAccess = getCustomRoleAccessByName(resolvedRole);
      const isCustomRole = !isStandardRole(resolvedRole);

      return userService.createUser({
        ...values,
        role: resolvedRole,
        adminPageAccess: isCustomRole ? customRoleAccess : undefined,
        approvalStatus: 'pending',
        isActive: true,
        registrationComplete: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      form.reset(userFormDefaults);
      setCreateUserOpen(false);
    }
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }) => {
      const resolvedRole = String(values.role || '').trim() || 'Member';
      const customRoleAccess = getCustomRoleAccessByName(resolvedRole);
      const isCustomRole = !isStandardRole(resolvedRole);

      return userService.updateUser(id, {
        ...values,
        role: resolvedRole,
        adminPageAccess: isCustomRole ? customRoleAccess : undefined,
        avatarUrl: String(editAvatarUrl || '').trim()
      });
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUserId('');
      if (currentUser?.id && currentUser.id === variables?.id && response?.data) {
        persistUser(response.data);
      }
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => userService.updateUser(id, { isActive }),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (currentUser?.id && currentUser.id === variables?.id && response?.data) {
        persistUser(response.data);
      }
    }
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ id, approvalStatus }) => {
      const updateResponse = await userService.updateApprovalStatus(id, approvalStatus);
      let emailResponse = null;

      if (approvalStatus === 'approved' && updateResponse?.data) {
        emailResponse = await notificationService.sendApprovalEmail(updateResponse.data);
      }

      return { updateResponse, emailResponse, approvalStatus, id };
    },
    onSuccess: ({ updateResponse, emailResponse, approvalStatus, id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (currentUser?.id && currentUser.id === id && updateResponse?.data) {
        persistUser(updateResponse.data);
      }

      if (approvalStatus === 'approved') {
        const sent = Boolean(emailResponse?.data?.sent);
        setApprovalNotice(sent ? 'User approved and approval email sent.' : 'User approved. Approval email could not be sent.');
      } else {
        setApprovalNotice('User approval status updated.');
      }
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id) => userService.removeUser(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (viewUser?.id === id) {
        setViewUser(null);
      }
      if (editUserId === id) {
        setEditUserId('');
      }
    }
  });

  const filteredUsers = useMemo(() => {
    if (activeFilter === 'All') {
      return users;
    }

    return users.filter((user) => String(user.approvalStatus || 'pending').toLowerCase() === activeFilter.toLowerCase());
  }, [activeFilter, users]);

  const desktopFilteredUsers = useMemo(() => {
    const searchTerm = String(desktopSearchTerm || '').trim().toLowerCase();
    if (!searchTerm) {
      return filteredUsers;
    }

    return filteredUsers.filter((user) => {
      const haystack = [user.name, user.email, user.role, user.approvalStatus]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(searchTerm);
    });
  }, [desktopSearchTerm, filteredUsers]);

  const mobileFilteredUsers = useMemo(() => {
    const searchTerm = String(mobileSearchTerm || '').trim().toLowerCase();
    if (!searchTerm) {
      return filteredUsers;
    }

    return filteredUsers.filter((user) => {
      const haystack = [user.name, user.email, user.role, user.approvalStatus]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(searchTerm);
    });
  }, [filteredUsers, mobileSearchTerm]);

  const mobileTotalPages = Math.max(1, Math.ceil(mobileFilteredUsers.length / mobilePageSize));
  const safeMobilePage = Math.min(mobilePage, mobileTotalPages);
  const paginatedMobileUsers = useMemo(() => {
    const startIndex = (safeMobilePage - 1) * mobilePageSize;
    return mobileFilteredUsers.slice(startIndex, startIndex + mobilePageSize);
  }, [mobileFilteredUsers, safeMobilePage]);

  useEffect(() => {
    setMobilePage(1);
  }, [activeFilter, mobileSearchTerm]);

  useEffect(() => {
    if (safeMobilePage !== mobilePage) {
      setMobilePage(safeMobilePage);
    }
  }, [mobilePage, safeMobilePage]);

  const openEditUser = (user) => {
    setViewUser(null);
    setEditUserId(user.id);
    setEditAvatarUrl(String(getAvatarUrl(user) || ''));
    setIsEditImageUploading(false);
    setEditImageUploadProgress(0);
    setEditImageUploadError('');
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
    setEditAvatarUrl('');
    setIsEditImageUploading(false);
    setEditImageUploadProgress(0);
    setEditImageUploadError('');
  };

  const handleEditAvatarSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsEditImageUploading(true);
      setEditImageUploadError('');
      const uploaded = await uploadService.uploadFile({
        service: 'users',
        file,
        allowedMimeTypes: ['image/*'],
        maxSizeMB: 5,
        onProgress: setEditImageUploadProgress
      });
      const nextUrl = String(uploaded?.url || '').trim();
      if (!nextUrl) {
        throw new Error('Upload did not return a file URL.');
      }
      setEditAvatarUrl(nextUrl);
    } catch (error) {
      setEditImageUploadError(error?.message || 'Unable to upload profile image right now.');
    } finally {
      setIsEditImageUploading(false);
      event.target.value = '';
    }
  };

  const viewUserAccess = useMemo(() => getDefaultAdminPageAccess(viewUser || {}), [viewUser]);
  const editUserRecord = useMemo(() => users.find((entry) => entry.id === editUserId) || null, [editUserId, users]);

  const renderActivePill = (user) => {
    const isActive = user.isActive !== false;
    const activeLabel = isActive ? 'Active' : 'Inactive';

    return (
      <button
        type="button"
        onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !isActive })}
        disabled={toggleActiveMutation.isPending}
        className={`inline-flex w-full items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold transition ${activeStatusClassMap[isActive ? 'active' : 'inactive']} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {activeLabel}
      </button>
    );
  };

  const renderApprovalPill = (approvalStatus) => (
    <span className={`inline-flex w-full items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClassMap[approvalStatus] || statusClassMap.pending}`}>
      {approvalStatus}
    </span>
  );

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

        <div className="mb-4 lg:hidden">
          <label className="block text-sm font-semibold text-slate-700">
            Search users
            <input
              type="search"
              value={mobileSearchTerm}
              onChange={(event) => setMobileSearchTerm(event.target.value)}
              placeholder="Search name, email, role, status"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-blue"
            />
          </label>
        </div>

        <div className="mb-4 hidden lg:block">
          <label className="block text-sm font-semibold text-slate-700">
            Search users
            <input
              type="search"
              value={desktopSearchTerm}
              onChange={(event) => setDesktopSearchTerm(event.target.value)}
              placeholder="Search name, email, role, status"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-blue"
            />
          </label>
        </div>

        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
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
              {desktopFilteredUsers.map((user) => {
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

              {desktopFilteredUsers.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={7}>No users found for this tab.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 lg:hidden">
          {paginatedMobileUsers.length > 0 ? paginatedMobileUsers.map((user) => {
            const approvalStatus = String(user.approvalStatus || 'pending').toLowerCase();
            const avatarUrl = getAvatarUrl(user);
            return (
              <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <img
                        src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}`}
                        alt={user.name}
                        className="h-10 w-10 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
                        <p className="truncate text-[12px] text-slate-600">{user.email}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-medium text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{user.role || '-'}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</span>
                    </div>

                    <div className="mt-3 grid w-full grid-cols-2 gap-2">
                      <div className="min-w-0">{renderApprovalPill(approvalStatus)}</div>
                      <div className="min-w-0">{renderActivePill(user)}</div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
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
                </div>
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
              No users found for this search or tab.
            </div>
          )}

          {mobileFilteredUsers.length > 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <button
                type="button"
                onClick={() => setMobilePage((prev) => Math.max(1, prev - 1))}
                disabled={safeMobilePage === 1}
                className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Page {safeMobilePage} of {mobileTotalPages}
              </p>
              <button
                type="button"
                onClick={() => setMobilePage((prev) => Math.min(mobileTotalPages, prev + 1))}
                disabled={safeMobilePage >= mobileTotalPages}
                className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      {createUserOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeModals} aria-hidden="true" />
          <div className="relative z-10 my-4 flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:my-6 sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h3 className="font-heading text-lg font-semibold">Add User</h3>
              <button type="button" onClick={closeModals} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close add user modal">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <form className="grid gap-3 md:grid-cols-3" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
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
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-3 flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Adding...' : 'Add User'}</Button>
                  <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {viewUser ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeModals} aria-hidden="true" />
          <div className="relative z-10 my-4 flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:my-6 sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-blue px-6 py-5 text-white">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                  <img
                    src={getAvatarSrc(viewUser)}
                    alt={viewUser?.name || 'User'}
                    className="h-18 w-18 rounded-xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="font-heading text-2xl font-semibold">User Details</h3>
                  <p className="text-sm text-white/75">Profile snapshot and access summary</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-white/15 px-3 py-1">{viewUser.role || 'Member'}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-100">{viewUser.isActive === false ? 'Inactive' : 'Active'}</span>
                      <span className={`rounded-full px-3 py-1 ${String(viewUser.approvalStatus || 'pending').toLowerCase() === 'approved' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-amber-500/20 text-amber-100'}`}>
                        {(viewUser.approvalStatus || 'pending').charAt(0).toUpperCase() + String(viewUser.approvalStatus || 'pending').slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <button type="button" onClick={closeModals} className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close view modal">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Profile</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</p>
                      <p className="mt-1 font-semibold text-slate-900">{viewUser.name || '-'}</p>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                      <p className="mt-1 break-words text-slate-700">{viewUser.email || '-'}</p>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                      <p className="mt-1 text-slate-700">{viewUser.phone || '-'}</p>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access</p>
                      <p className="mt-1 text-slate-700">{viewUserAccess.length} assigned</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</p>
                        <p className="mt-2 text-sm text-slate-700">{viewUser.address || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Joined</p>
                        <p className="mt-2 text-sm text-slate-700">{viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleDateString() : '-'}</p>
                      </div>
                    </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Approval and Access</p>
                        <p className="mt-1 text-sm text-slate-600">Assigned admin pages.</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap gap-2">
                        {viewUserAccess.length > 0 ? (
                          viewUserAccess.map((path) => {
                            const label = adminPageOptions.find((item) => item.path === path)?.label || path;
                            return (
                              <span key={path} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                                {label}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-sm text-slate-500">No admin pages assigned.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-slate-200 pt-4">
                <Button type="button" variant="ghost" onClick={closeModals}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editUserId ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeModals} aria-hidden="true" />
          <div className="relative z-10 my-4 flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:my-6 sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-brand-blue to-slate-950 px-6 py-5 text-white">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                  <img
                    src={getAvatarSrc(editUserRecord || {})}
                    alt={editUserRecord?.name || 'User'}
                    className="h-18 w-18 rounded-xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Edit profile</p>
                  <h3 className="mt-1 font-heading text-2xl font-semibold">{editUserRecord?.name || 'Edit User'}</h3>
                  <p className="mt-1 text-sm text-white/75">Update account details and profile information.</p>
                </div>
              </div>
              <button type="button" onClick={closeModals} className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close edit modal">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form className="flex-1 overflow-y-auto px-6 py-5" onSubmit={editForm.handleSubmit((values) => editMutation.mutate({ id: editUserId, values }))}>
              <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Current profile</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</p>
                      <p className="mt-1 font-semibold text-slate-900">{editUserRecord?.role || 'Member'}</p>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approval</p>
                      <p className="mt-1 text-slate-700">{editUserRecord?.approvalStatus || 'pending'}</p>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access</p>
                      <p className="mt-1 text-slate-700">{getDefaultAdminPageAccess(editUserRecord || {}).length} pages</p>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Joined</p>
                      <p className="mt-1 text-slate-700">{editUserRecord?.createdAt ? new Date(editUserRecord.createdAt).toLocaleDateString() : '-'}</p>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                      <p className="mt-1 text-slate-700">{editUserRecord?.approvalStatus || 'pending'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Profile photo</p>
                    <div className="mt-3 flex items-center gap-3">
                      <img
                        src={editAvatarUrl || getAvatarSrc(editUserRecord || {})}
                        alt={editUserRecord?.name || 'User'}
                        className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <label className="inline-flex cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Upload photo
                          <input type="file" accept="image/*" className="hidden" onChange={handleEditAvatarSelected} />
                        </label>
                        {isEditImageUploading ? (
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">Uploading {editImageUploadProgress}%</p>
                        ) : (
                          <p className="mt-1 text-[11px] text-slate-500">Image up to 5MB</p>
                        )}
                        {editImageUploadError ? <p className="mt-1 text-[11px] font-semibold text-red-600">{editImageUploadError}</p> : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-sm font-semibold text-slate-700">Name
                      <input {...editForm.register('name', { required: true })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm outline-none transition focus:border-brand-blue" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">Email
                      <input type="email" {...editForm.register('email', { required: true })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm outline-none transition focus:border-brand-blue" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">Phone
                      <input {...editForm.register('phone')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm outline-none transition focus:border-brand-blue" />
                    </label>
                  </div>

                  <div className="border-t border-slate-200 pt-5">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm font-semibold text-slate-700 md:col-span-2">Address
                        <textarea {...editForm.register('address')} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm outline-none transition focus:border-brand-blue" />
                      </label>
                      <div className="md:col-span-2 h-px bg-slate-200" />
                      <label className="text-sm font-semibold text-slate-700 md:col-span-2">Role
                        <select {...editForm.register('role')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm outline-none transition focus:border-brand-blue">
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
                <Button type="submit" disabled={editMutation.isPending || isEditImageUploading}>{editMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default AdminUsersPage;
