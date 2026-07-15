import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import notificationService from '../../services/notificationService';

const AdminSubscribersPage = () => {
  const queryClient = useQueryClient();
  const { data: subscribers = [] } = useQuery({
    queryKey: ['subscribers'],
    queryFn: () => notificationService.getSubscribers().then((res) => res.data)
  });

  const removeMutation = useMutation({
    mutationFn: (id) => notificationService.removeSubscriber(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscribers'] })
  });

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Email Subscribers</h1>
      <div className="space-y-3">
        {subscribers.length === 0 ? (
          <Card><p className="text-sm text-slate-500">No subscribers yet.</p></Card>
        ) : subscribers.map((subscriber) => (
          <Card key={subscriber.id}>
            <p className="font-semibold text-slate-800">{subscriber.name || subscriber.email}</p>
            <p className="text-sm text-slate-500">{subscriber.email}</p>
            <p className="text-xs text-slate-500">{subscriber.interests}</p>
            <div className="mt-3 flex gap-2">
              <a href={`mailto:${subscriber.email}`} className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white">Email</a>
              <button type="button" onClick={() => removeMutation.mutate(subscriber.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600">Remove</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminSubscribersPage;
