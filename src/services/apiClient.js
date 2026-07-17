import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('gurdwara_token');
  const rawUser = localStorage.getItem('gurdwara_user');
  let actor = null;

  if (rawUser) {
    try {
      actor = JSON.parse(rawUser);
    } catch {
      actor = null;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (actor?.email) {
    config.headers['X-Actor-Email'] = String(actor.email).toLowerCase();
  }
  if (actor?.role) {
    config.headers['X-Actor-Role'] = String(actor.role);
  }
  if (actor?.name) {
    config.headers['X-Actor-Name'] = String(actor.name);
  }

  return config;
});

export default apiClient;
