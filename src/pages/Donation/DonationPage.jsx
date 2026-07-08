import { useMutation, useQuery } from '@tanstack/react-query';
import PageHero from '../../components/common/PageHero';
import SectionTitle from '../../components/common/SectionTitle';
import DonationForm from '../../components/forms/DonationForm';
import Card from '../../components/ui/Card';
import donationService from '../../services/donationService';
import { formatCurrency } from '../../utils/formatters';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';

const DonationPage = () => {
  const meta = useSeoMeta('Donation', 'One-time and monthly donation options with campaign-based contribution support.');
  const { data: campaigns = [] } = useQuery({ queryKey: ['campaigns'], queryFn: () => donationService.getCampaigns().then((res) => res.data) });

  const donateMutation = useMutation({
    mutationFn: (payload) => donationService.donate(payload),
    onSuccess: (response) => {
      window.alert(`Donation successful. Receipt: ${response.data.receiptId}`);
    }
  });

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title="Support Through Donation" description="Secure one-time and recurring contributions for langar, infrastructure, and Sikh education." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="Campaigns" />
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <h3 className="font-heading text-lg font-semibold">{campaign.name}</h3>
                <p className="mt-2 text-sm">Raised {formatCurrency(campaign.raised)} of {formatCurrency(campaign.target)}</p>
                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-2 rounded-full bg-brand-saffron" style={{ width: `${Math.min((campaign.raised / campaign.target) * 100, 100)}%` }} />
                </div>
              </Card>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle title="Donation Form" subtitle="Payment gateway integration placeholder." />
          <Card>
            <DonationForm
              onSubmit={(values) => donateMutation.mutate(values)}
              loading={donateMutation.isPending}
            />
          </Card>
        </section>
      </div>
    </div>
  );
};

export default DonationPage;
