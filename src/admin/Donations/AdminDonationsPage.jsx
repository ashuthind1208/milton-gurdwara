import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import donationService from '../../services/donationService';
import { formatCurrency } from '../../utils/formatters';
import Button from '../../components/ui/Button';

const AdminDonationsPage = () => {
  const queryClient = useQueryClient();
  const form = useForm({ defaultValues: { name: '', raised: 0, target: 0 } });
  const { data: campaigns = [] } = useQuery({ queryKey: ['admin-campaigns'], queryFn: () => donationService.getCampaigns().then((res) => res.data) });

  const createMutation = useMutation({
    mutationFn: (values) => donationService.createCampaign(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      form.reset({ name: '', raised: 0, target: 0 });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => donationService.removeCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Donation Management</h1>
      <Card>
        <h2 className="font-heading text-xl font-semibold">Create Donation Campaign</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
          <label className="text-sm">Campaign Name
            <input {...form.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Raised
            <input type="number" min="0" {...form.register('raised')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Target
            <input type="number" min="0" {...form.register('target', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <div className="md:col-span-3">
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Campaign'}</Button>
          </div>
        </form>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <h2 className="font-semibold">{campaign.name}</h2>
            <p className="mt-2 text-sm">{formatCurrency(campaign.raised)} raised of {formatCurrency(campaign.target)}</p>
            <button type="button" onClick={() => deleteMutation.mutate(campaign.id)} className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Delete</button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDonationsPage;
