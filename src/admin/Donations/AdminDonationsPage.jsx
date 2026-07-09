import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import donationService from '../../services/donationService';
import { formatCurrency } from '../../utils/formatters';
import Button from '../../components/ui/Button';

const AdminDonationsPage = () => {
  const queryClient = useQueryClient();
  const [editingCampaign, setEditingCampaign] = useState(null);
  const form = useForm({ defaultValues: { name: '', description: '', raised: 0, target: 0, isActive: true, paymentProvider: 'STRIPE', paymentLink: '', stripeBuyButtonId: '', stripePublishableKey: '' } });
  const editForm = useForm({ defaultValues: { name: '', description: '', raised: 0, target: 0, isActive: true, paymentProvider: 'STRIPE', paymentLink: '', stripeBuyButtonId: '', stripePublishableKey: '' } });
  const { data: campaigns = [] } = useQuery({ queryKey: ['admin-campaigns'], queryFn: () => donationService.getAllCampaigns().then((res) => res.data) });
  const { data: donations = [] } = useQuery({ queryKey: ['admin-donations'], queryFn: () => donationService.getDonations().then((res) => res.data) });

  const createMutation = useMutation({
    mutationFn: (values) => donationService.createCampaign(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      form.reset({ name: '', description: '', raised: 0, target: 0, isActive: true, paymentProvider: 'STRIPE', paymentLink: '', stripeBuyButtonId: '', stripePublishableKey: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => donationService.updateCampaign(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setEditingCampaign(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => donationService.removeCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const openEdit = (campaign) => {
    setEditingCampaign(campaign);
    editForm.reset({
      name: campaign.name,
      description: campaign.description || '',
      raised: campaign.raised,
      target: campaign.target,
      isActive: Boolean(campaign.isActive),
      paymentProvider: campaign.paymentProvider || 'STRIPE',
      paymentLink: campaign.paymentLink || '',
      stripeBuyButtonId: campaign.stripeBuyButtonId || '',
      stripePublishableKey: campaign.stripePublishableKey || ''
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Donation Management</h1>
      <Card>
        <h2 className="font-heading text-xl font-semibold">Create Donation Campaign</h2>
        <p className="mt-2 text-xs text-slate-500">
          Stripe/PayPal field accepts either a full checkout URL, a URL template with placeholders ({'{AMOUNT}'}, {'{AMOUNT_CENTS}'}, {'{EMAIL}'}, {'{NAME}'}, {'{CAMPAIGN}'}, {'{REFERENCE}'}), or a backend endpoint that returns a checkout URL.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
          <label className="text-sm">Campaign Name
            <input {...form.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Payment Provider
            <select {...form.register('paymentProvider')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
              <option value="STRIPE">Stripe</option>
              <option value="PAYPAL">PayPal</option>
            </select>
          </label>
          <label className="text-sm">Raised
            <input type="number" min="0" {...form.register('raised')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Target
            <input type="number" min="0" {...form.register('target', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm md:col-span-2">Description
            <textarea rows={2} {...form.register('description')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Checkout Link (optional)
            <input {...form.register('paymentLink')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://buy.stripe.com/... or /api/payments/create-session" />
          </label>
          <label className="text-sm">Stripe Buy Button ID (optional)
            <input {...form.register('stripeBuyButtonId')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="buy_btn_..." />
          </label>
          <label className="text-sm md:col-span-2">Stripe Publishable Key (optional)
            <input {...form.register('stripePublishableKey')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="pk_test_... or pk_live_..." />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input type="checkbox" {...form.register('isActive')} />
            Active campaign
          </label>
          <div className="md:col-span-3">
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Campaign'}</Button>
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="font-heading text-xl font-semibold">Campaigns</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Raised</th>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Checkout</th>
                <th className="py-2 pr-3">Stripe Button</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-slate-800">{campaign.name}</p>
                    {campaign.description ? <p className="text-xs text-slate-500">{campaign.description}</p> : null}
                  </td>
                  <td className="py-2 pr-3">{formatCurrency(campaign.target)}</td>
                  <td className="py-2 pr-3">{formatCurrency(campaign.raised)}</td>
                  <td className="py-2 pr-3">{campaign.paymentProvider}</td>
                  <td className="py-2 pr-3">{campaign.isActive ? (campaign.isClosed ? 'Closed' : 'Active') : 'Inactive'}</td>
                  <td className="py-2 pr-3">
                    {campaign.paymentLink ? <span className="text-xs text-slate-600">Configured</span> : <span className="text-xs text-red-600">Missing</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {campaign.stripeBuyButtonId && campaign.stripePublishableKey ? <span className="text-xs text-slate-600">Configured</span> : <span className="text-xs text-slate-400">-</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(campaign)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">Edit</button>
                      <button type="button" onClick={() => deleteMutation.mutate(campaign.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={8}>No campaigns yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-xl font-semibold">Donor List</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Donor</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Receipt</th>
                <th className="py-2 pr-3">Email Sent</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-3">{entry.donorName}</td>
                  <td className="py-2 pr-3">{entry.donorEmail || '-'}</td>
                  <td className="py-2 pr-3">{entry.campaignName}</td>
                  <td className="py-2 pr-3">{formatCurrency(entry.amount)}</td>
                  <td className="py-2 pr-3">{entry.receiptId}</td>
                  <td className="py-2 pr-3">{entry.emailSent ? 'Yes' : 'No'}</td>
                </tr>
              ))}
              {donations.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={7}>No donations yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {editingCampaign ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Campaign</h3>
              <button type="button" onClick={() => setEditingCampaign(null)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingCampaign.id, values }))}>
              <label className="text-sm">Campaign Name
                <input {...editForm.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Payment Provider
                <select {...editForm.register('paymentProvider')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option value="STRIPE">Stripe</option>
                  <option value="PAYPAL">PayPal</option>
                </select>
              </label>
              <label className="text-sm">Raised
                <input type="number" min="0" {...editForm.register('raised')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Target
                <input type="number" min="0" {...editForm.register('target', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Description
                <textarea rows={2} {...editForm.register('description')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Checkout Link (optional)
                <input {...editForm.register('paymentLink')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Stripe Buy Button ID (optional)
                <input {...editForm.register('stripeBuyButtonId')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Stripe Publishable Key (optional)
                <input {...editForm.register('stripePublishableKey')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...editForm.register('isActive')} />
                Active campaign
              </label>
              <div className="flex gap-2 md:col-span-3">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <button type="button" onClick={() => setEditingCampaign(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminDonationsPage;
