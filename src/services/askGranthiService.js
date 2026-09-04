import apiClient from './apiClient';

const askGranthiService = {
  getBoard: async () => {
    const response = await apiClient.get('/ask-granthi/board');
    return response.data;
  },
  askQuestion: async (question) => {
    const response = await apiClient.post('/ask-granthi/questions', { question }, { timeout: 70000 });
    return response.data;
  },
  getQuestions: async () => {
    const response = await apiClient.get('/ask-granthi/questions');
    return response.data;
  },
  updateQuestion: async (id, payload) => {
    const response = await apiClient.patch(`/ask-granthi/questions/${encodeURIComponent(id)}`, payload);
    return response.data;
  },
  retryQuestion: async (id) => {
    const response = await apiClient.post(`/ask-granthi/questions/${encodeURIComponent(id)}/retry`, {}, { timeout: 70000 });
    return response.data;
  },
  removeQuestion: async (id) => {
    const response = await apiClient.delete(`/ask-granthi/questions/${encodeURIComponent(id)}`);
    return response.data;
  }
};

export default askGranthiService;