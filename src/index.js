import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

const GOOGLE_OAUTH_CALLBACK_STORAGE_KEY = 'ssm_google_oauth_callback_hash';

const preserveGoogleOAuthCallback = () => {
  const hashValue = window.location.hash || '';
  const hashParams = new URLSearchParams(hashValue.startsWith('#') ? hashValue.slice(1) : hashValue);
  if (!hashParams.has('access_token') && !hashParams.has('error')) {
    return;
  }

  try {
    window.sessionStorage.setItem(GOOGLE_OAUTH_CALLBACK_STORAGE_KEY, hashValue);
  } catch {
    return;
  }

  window.history.replaceState(null, '', '/login');
};

preserveGoogleOAuthCallback();

const migrateLegacyHashRoute = () => {
  const hashValue = window.location.hash || '';
  if (!hashValue.startsWith('#/')) {
    return;
  }

  window.history.replaceState(null, '', hashValue.slice(1));
};

migrateLegacyHashRoute();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false
    }
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
