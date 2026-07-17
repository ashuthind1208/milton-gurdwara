import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PageHero from '../../components/common/PageHero';
import Card from '../../components/ui/Card';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import authService from '../../services/authService';

const PENDING_APPROVAL_NOTICE = 'Access is pending till your status is approved by an admin.';
const FULL_ACCESS_ROLES = new Set(['Super Admin', 'Admin']);

const getApprovalMessage = (user, role) => {
  if (FULL_ACCESS_ROLES.has(String(role || ''))) {
    return '';
  }

  if (user?.approvalStatus === 'rejected') {
    return 'Your registration was rejected. Please contact the admin team for help.';
  }

  if (user?.approvalStatus !== 'approved') {
    return PENDING_APPROVAL_NOTICE;
  }

  return '';
};

const resolvePostLoginPath = (candidatePath, role) => {
  const safeCandidate = candidatePath && candidatePath !== '/login' ? candidatePath : '';
  if (safeCandidate.startsWith('/admin') && !role) {
    return '/';
  }

  if (safeCandidate) {
    return safeCandidate;
  }

  return '/';
};

const LoginPage = () => {
  const meta = useSeoMeta('Sign In', 'Secure redirect to Google OAuth authentication.');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [autoOAuthTriggered, setAutoOAuthTriggered] = useState(false);

  const { loginWithGoogle, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = location.state?.from?.pathname || '';
  const accessNotice = location.state?.accessNotice || '';
  const searchParams = new URLSearchParams(location.search || '');
  const modeParam = String(searchParams.get('mode') || '').toLowerCase();
  const nextPath = searchParams.get('next') || '';
  const allowMockGoogleLogin = process.env.REACT_APP_ALLOW_MOCK_GOOGLE_LOGIN === 'true';

  const preferredPath = fromPath || nextPath;
  const effectivePreferredPath = preferredPath;

  const persistAuthIntent = useCallback((intent) => {
    try {
      window.sessionStorage.setItem('ssm_auth_intent', intent);
      window.localStorage.setItem('ssm_auth_intent', intent);
      window.sessionStorage.setItem('ssm_login_mode', '');
      window.localStorage.setItem('ssm_login_mode', '');
      window.sessionStorage.setItem('ssm_post_login_next', effectivePreferredPath || '');
      window.localStorage.setItem('ssm_post_login_next', effectivePreferredPath || '');
      window.sessionStorage.setItem('ssm_signup_role', 'Member');
      window.localStorage.setItem('ssm_signup_role', 'Member');
    } catch {
      // Ignore storage errors and rely on OAuth state.
    }
  }, [effectivePreferredPath]);

  const consumeAuthIntent = (hashParams) => {
    const fromState = hashParams.get('state');
    const authIntentFromState = fromState === 'signup' || fromState === 'signin' ? fromState : '';

    let intent = '';
    let loginMode = '';
    let postLoginNext = '';
    let signupRole = 'Member';
    try {
      intent = window.sessionStorage.getItem('ssm_auth_intent') || window.localStorage.getItem('ssm_auth_intent') || '';
      loginMode = window.sessionStorage.getItem('ssm_login_mode') || window.localStorage.getItem('ssm_login_mode') || '';
      postLoginNext = window.sessionStorage.getItem('ssm_post_login_next') || window.localStorage.getItem('ssm_post_login_next') || '';
      signupRole = window.sessionStorage.getItem('ssm_signup_role') || window.localStorage.getItem('ssm_signup_role') || 'Member';
      window.sessionStorage.removeItem('ssm_auth_intent');
      window.localStorage.removeItem('ssm_auth_intent');
      window.sessionStorage.removeItem('ssm_login_mode');
      window.localStorage.removeItem('ssm_login_mode');
      window.sessionStorage.removeItem('ssm_post_login_next');
      window.localStorage.removeItem('ssm_post_login_next');
      window.sessionStorage.removeItem('ssm_signup_role');
      window.localStorage.removeItem('ssm_signup_role');
    } catch {
      // Ignore storage errors and use defaults.
    }

    return {
      authIntent: authIntentFromState || (intent === 'signup' ? 'signup' : 'signin'),
      recoveredIsJoinMode: loginMode === 'join',
      recoveredPreferredPath: postLoginNext || '',
      recoveredRequestedRole: signupRole || 'Member'
    };
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    const role = user?.role;
    const approvalMessage = getApprovalMessage(user, role);
    if (approvalMessage) {
      setNotice(approvalMessage);
      return;
    }

    navigate(resolvePostLoginPath(effectivePreferredPath, role), { replace: true });
  }, [effectivePreferredPath, isAuthenticated, navigate, user]);

  useEffect(() => {
    if (accessNotice === 'approval_pending') {
      setNotice(PENDING_APPROVAL_NOTICE);
      return;
    }
    if (accessNotice === 'registration_rejected') {
      setError('Your registration was rejected. Please contact admin for support.');
      return;
    }
    if (accessNotice === 'registration_required') {
      setNotice('Please complete registration to continue.');
    }
  }, [accessNotice]);

  useEffect(() => {
    if (notice !== PENDING_APPROVAL_NOTICE) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice('');
      navigate('/', { replace: true });
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [navigate, notice]);

  useEffect(() => {
    let cancelled = false;

    const completeGoogleRedirect = async () => {
      const hashValue = window.location.hash || '';
      if (!hashValue.includes('access_token=')) {
        return;
      }

      const queryText = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue;
      const hashParams = new URLSearchParams(queryText);
      const accessToken = hashParams.get('access_token');
      const oauthError = hashParams.get('error');

      if (oauthError) {
        setError(`Google sign-in error: ${oauthError}`);
        return;
      }

      if (!accessToken) {
        return;
      }

      let profile = null;
      try {
        const { authIntent, recoveredPreferredPath } = consumeAuthIntent(hashParams);
        const callbackPreferredPath = effectivePreferredPath || recoveredPreferredPath;

        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!profileResponse.ok) {
          throw new Error('Unable to fetch Google profile.');
        }

        profile = await profileResponse.json();
        if (cancelled) {
          return;
        }

        const activeIntent = authIntent === 'signup' ? 'signup' : 'signin';
        const response = await loginWithGoogle({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture,
          intent: activeIntent
        });

        if (cancelled) {
          return;
        }

        const role = response?.data?.user?.role;
        const approvalMessage = getApprovalMessage(response?.data?.user, role);
        if (approvalMessage) {
          setNotice(approvalMessage);
          return;
        }

        navigate(resolvePostLoginPath(callbackPreferredPath, role), { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError('Google sign-in failed. Please try again.');
        }
      }
    };

    completeGoogleRedirect();

    return () => {
      cancelled = true;
    };
  }, [effectivePreferredPath, loginWithGoogle, navigate]);

  const handleGoogleSignIn = useCallback(async (intent = 'signin') => {
    setError('');
    setNotice('');

    const oauthUrl = authService.getGoogleOAuthUrl();
    if (oauthUrl) {
      if (oauthUrl.includes('accounts.google.com/o/oauth2')) {
        const parsedOAuthUrl = new URL(oauthUrl);
        const hasRequiredParams = (
          parsedOAuthUrl.searchParams.get('client_id')
          && parsedOAuthUrl.searchParams.get('redirect_uri')
          && parsedOAuthUrl.searchParams.get('response_type')
          && parsedOAuthUrl.searchParams.get('scope')
        );

        if (!hasRequiredParams) {
          setError('Google OAuth URL is incomplete. Add client_id, redirect_uri, response_type, and scope in REACT_APP_GOOGLE_OAUTH_URL.');
          return;
        }

        parsedOAuthUrl.searchParams.set('state', intent);
        persistAuthIntent(intent);
        window.location.assign(parsedOAuthUrl.toString());
        return;
      }

      persistAuthIntent(intent);
      window.location.assign(oauthUrl);
      return;
    }

    if (!allowMockGoogleLogin) {
      setError('Google OAuth is not loaded. Check REACT_APP_GOOGLE_OAUTH_URL and restart npm start.');
      return;
    }

    try {
      const activeIntent = intent === 'signup' ? 'signup' : 'signin';
      const response = await loginWithGoogle({ intent: activeIntent });

      const role = response?.data?.user?.role;

      const approvalMessage = getApprovalMessage(response?.data?.user, role);
      if (approvalMessage) {
        setNotice(approvalMessage);
        return;
      }

      navigate(resolvePostLoginPath(effectivePreferredPath, role), { replace: true });
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
    }
  }, [allowMockGoogleLogin, effectivePreferredPath, loginWithGoogle, navigate, persistAuthIntent]);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    const hasOAuthToken = (window.location.hash || '').includes('access_token=');
    if (hasOAuthToken || autoOAuthTriggered) {
      return;
    }

    const intent = modeParam === 'join' ? 'signup' : 'signin';
    setAutoOAuthTriggered(true);
    handleGoogleSignIn(intent);
  }, [autoOAuthTriggered, handleGoogleSignIn, isAuthenticated, modeParam]);

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero
        title="Secure Sign In"
        description={'Redirecting to Google OAuth. Please wait...'}
      />

      <Card className="mx-auto max-w-md">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-brand-blue" />
          <p className="text-sm font-semibold text-slate-800">
            Redirecting to Google sign-in...
          </p>
          <p className="text-xs text-slate-500">Please wait while we securely continue the authentication flow.</p>
          {!authService.getGoogleOAuthUrl() ? (
            <p className="text-xs text-slate-500">Google OAuth URL not detected. Restart the app after updating .env.local. Mock Google login fallback is enabled.</p>
          ) : null}
        </div>
        {notice ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
        {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </Card>


    </div>
  );
};

export default LoginPage;
