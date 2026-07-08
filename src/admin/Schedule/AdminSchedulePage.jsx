import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import cmsService from '../../services/cmsService';

const AdminSchedulePage = () => {
  const queryClient = useQueryClient();
  const form = useForm();

  const { data: cmsData } = useQuery({
    queryKey: ['cms-home'],
    queryFn: () => cmsService.getHomeContent().then((res) => res.data)
  });

  useEffect(() => {
    if (!cmsData?.schedule) {
      return;
    }

    form.reset({
      morningOneTime: cmsData.schedule.morning?.[0]?.time || '',
      morningOneLabel: cmsData.schedule.morning?.[0]?.label || '',
      morningTwoTime: cmsData.schedule.morning?.[1]?.time || '',
      morningTwoLabel: cmsData.schedule.morning?.[1]?.label || '',
      morningThreeTime: cmsData.schedule.morning?.[2]?.time || '',
      morningThreeLabel: cmsData.schedule.morning?.[2]?.label || '',
      eveningOneTime: cmsData.schedule.evening?.[0]?.time || '',
      eveningOneLabel: cmsData.schedule.evening?.[0]?.label || '',
      eveningTwoTime: cmsData.schedule.evening?.[1]?.time || '',
      eveningTwoLabel: cmsData.schedule.evening?.[1]?.label || '',
      eveningThreeTime: cmsData.schedule.evening?.[2]?.time || '',
      eveningThreeLabel: cmsData.schedule.evening?.[2]?.label || '',
      eveningFourTime: cmsData.schedule.evening?.[3]?.time || '',
      eveningFourLabel: cmsData.schedule.evening?.[3]?.label || ''
    });
  }, [cmsData, form]);

  const mutation = useMutation({
    mutationFn: (values) => cmsService.updateSchedule({
      morning: [
        { time: values.morningOneTime, label: values.morningOneLabel },
        { time: values.morningTwoTime, label: values.morningTwoLabel },
        { time: values.morningThreeTime, label: values.morningThreeLabel }
      ].filter((item) => item.time || item.label),
      evening: [
        { time: values.eveningOneTime, label: values.eveningOneLabel },
        { time: values.eveningTwoTime, label: values.eveningTwoLabel },
        { time: values.eveningThreeTime, label: values.eveningThreeLabel },
        { time: values.eveningFourTime, label: values.eveningFourLabel }
      ].filter((item) => item.time || item.label)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
      window.alert('Daily schedule updated successfully.');
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Daily Schedule</h1>
      <Card>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">Morning 1 Time<input {...form.register('morningOneTime')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Morning 1 Content<input {...form.register('morningOneLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Morning 2 Time<input {...form.register('morningTwoTime')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Morning 2 Content<input {...form.register('morningTwoLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Morning 3 Time<input {...form.register('morningThreeTime')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Morning 3 Content<input {...form.register('morningThreeLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Evening 1 Time<input {...form.register('eveningOneTime')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Evening 1 Content<input {...form.register('eveningOneLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Evening 2 Time<input {...form.register('eveningTwoTime')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Evening 2 Content<input {...form.register('eveningTwoLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Evening 3 Time<input {...form.register('eveningThreeTime')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Evening 3 Content<input {...form.register('eveningThreeLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Evening 4 Time<input {...form.register('eveningFourTime')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="text-sm">Evening 4 Content<input {...form.register('eveningFourLabel')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
          </div>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save Schedule'}</Button>
        </form>
      </Card>
    </div>
  );
};

export default AdminSchedulePage;
