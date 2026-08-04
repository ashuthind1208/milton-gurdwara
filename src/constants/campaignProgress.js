export const CAMPAIGN_PROGRESS_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'planned', label: 'Planned' },
  { value: 'started', label: 'Started' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'under-development', label: 'Under Development' },
  { value: 'awaiting-materials', label: 'Awaiting Materials' },
  { value: 'awaiting-approval', label: 'Awaiting Approval' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' }
];

const progressStatusMap = new Map(CAMPAIGN_PROGRESS_STATUSES.map((option) => [option.value, option]));

export const normalizeCampaignProgressStatus = (value, isActive = true) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  if (progressStatusMap.has(normalized)) {
    return normalized;
  }

  return isActive === false ? 'archived' : 'started';
};

export const getCampaignProgressStatusLabel = (value, isActive = true) => {
  const status = normalizeCampaignProgressStatus(value, isActive);
  return progressStatusMap.get(status)?.label || 'Started';
};

export const getCampaignProgressStatusClassName = (value, isActive = true) => {
  const status = normalizeCampaignProgressStatus(value, isActive);
  const classNames = {
    draft: 'bg-slate-100 text-slate-700',
    planned: 'bg-sky-100 text-sky-800',
    started: 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-amber-100 text-amber-800',
    'under-development': 'bg-cyan-100 text-cyan-800',
    'awaiting-materials': 'bg-violet-100 text-violet-800',
    'awaiting-approval': 'bg-indigo-100 text-indigo-800',
    'on-hold': 'bg-orange-100 text-orange-800',
    delayed: 'bg-rose-100 text-rose-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-800',
    archived: 'bg-slate-200 text-slate-700'
  };

  return classNames[status] || classNames.started;
};

export const isCampaignProgressVisible = (value, isActive = true) => {
  const status = normalizeCampaignProgressStatus(value, isActive);
  return status !== 'draft' && status !== 'archived';
};