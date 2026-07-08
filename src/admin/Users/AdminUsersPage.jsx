import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import userService from '../../services/userService';

const AdminUsersPage = () => {
  const queryClient = useQueryClient();
  const form = useForm({ defaultValues: { name: '', role: 'Editor', email: '' } });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => userService.getUsers().then((res) => res.data) });

  const createMutation = useMutation({
    mutationFn: (values) => userService.createUser(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      form.reset({ name: '', role: 'Editor', email: '' });
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id) => userService.removeUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  });

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
      <div className="grid gap-4 md:grid-cols-2">
        {users.map((user) => (
          <Card key={user.id}>
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{user.role}</p>
            <button type="button" onClick={() => removeMutation.mutate(user.id)} className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Delete</button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminUsersPage;
