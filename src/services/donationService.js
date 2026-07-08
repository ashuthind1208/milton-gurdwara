import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-donation-campaigns';

const seedCampaigns = [
  { id: 1, name: 'Langar Fund', raised: 42000, target: 60000 },
  { id: 2, name: 'Building Fund', raised: 110000, target: 250000 },
  { id: 3, name: 'Education Seva', raised: 18000, target: 30000 }
];

const readCampaigns = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedCampaigns;
    }
    return JSON.parse(raw);
  } catch {
    return seedCampaigns;
  }
};

const writeCampaigns = (records) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write errors in mock mode.
  }
};

const donationService = {
  getCampaigns: async () => mockResponse(readCampaigns()),
  createCampaign: async (payload) => {
    const record = {
      id: Date.now(),
      name: payload.name,
      raised: Number(payload.raised || 0),
      target: Number(payload.target || 0)
    };
    const next = [record, ...readCampaigns()];
    writeCampaigns(next);
    return mockResponse(record);
  },
  updateCampaign: async (id, payload) => {
    const next = readCampaigns().map((campaign) => (
      campaign.id === id ? { ...campaign, ...payload } : campaign
    ));
    writeCampaigns(next);
    return mockResponse(next.find((campaign) => campaign.id === id));
  },
  removeCampaign: async (id) => {
    const next = readCampaigns().filter((campaign) => campaign.id !== id);
    writeCampaigns(next);
    return mockResponse({ success: true });
  },
  donate: async (payload) =>
    mockResponse({
      success: true,
      receiptId: `R-${Date.now()}`,
      ...payload
    })
};

export default donationService;
