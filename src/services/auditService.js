import contentApiService from './contentApiService';

const sortLogs = (rows = []) => {
  return [...rows].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
};

const auditService = {
  getLogs: async () => {
    const rows = await contentApiService.list('audit_logs');
    return { data: sortLogs(rows) };
  }
};

export default auditService;
