import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import PageHero from '../../components/common/PageHero';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import authService from '../../services/authService';

const MEMBER_CONTRIBUTOR_PATHS = ['/admin/events', '/admin/seva-opportunities'];
const PENDING_APPROVAL_NOTICE = 'Your registration is pending admin approval. You can sign in again once approved.';

const resolveMemberContributorPath = (candidatePath) => {
  if (MEMBER_CONTRIBUTOR_PATHS.includes(candidatePath)) {
    return candidatePath;
  }
  return '/admin/events';
};

const getApprovalMessage = (user, role) => {
  if (role) {
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

const resolvePostLoginPath = (candidatePath, role, isJoinMode = false) => {
  const safeCandidate = candidatePath && candidatePath !== '/login' ? candidatePath : '';
  if (safeCandidate.startsWith('/admin') && !role && !MEMBER_CONTRIBUTOR_PATHS.includes(safeCandidate)) {
    return '/';
  }

  if (!safeCandidate && isJoinMode) {
    return '/seva';
  }

  return safeCandidate || (role ? '/admin' : '/donation');
};

const LoginPage = () => {
  const meta = useSeoMeta('Sign In', 'Secure redirect to Google OAuth authentication.');
  const registrationForm = useForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      memberType: 'Member'
    }
  });
  const { reset: resetRegistrationForm } = registrationForm;

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingRegistrationUser, setPendingRegistrationUser] = useState(null);
  const [oauthRedirectContext, setOauthRedirectContext] = useState({ isJoinMode: false, preferredPath: '' });
  const [autoOAuthTriggered, setAutoOAuthTriggered] = useState(false);

  const { loginWithGoogle, completeRegistration, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = location.state?.from?.pathname || '';
  const accessNotice = location.state?.accessNotice || '';
  const searchParams = new URLSearchParams(location.search || '');
  const isJoinMode = searchParams.get('mode') === 'join';
  const nextPath = searchParams.get('next') || '';
  const allowMockGoogleLogin = process.env.REACT_APP_ALLOW_MOCK_GOOGLE_LOGIN === 'true';

  const preferredPath = fromPath || nextPath;
  const effectiveIsJoinMode = isJoinMode || oauthRedirectContext.isJoinMode;
  const effectivePreferredPath = preferredPath || oauthRedirectContext.preferredPath;
  const isMemberContributorPath = useMemo(
    () => MEMBER_CONTRIBUTOR_PATHS.includes(effectivePreferredPath),
    [effectivePreferredPath]
  );

  const persistAuthIntent = useCallback((intent) => {
    try {
      window.sessionStorage.setItem('ssm_auth_intent', intent);
      window.localStorage.setItem('ssm_auth_intent', intent);
      window.sessionStorage.setItem('ssm_login_mode', effectiveIsJoinMode ? 'join' : '');
      window.localStorage.setItem('ssm_login_mode', effectiveIsJoinMode ? 'join' : '');
      window.sessionStorage.setItem('ssm_post_login_next', effectivePreferredPath || '');
      window.localStorage.setItem('ssm_post_login_next', effectivePreferredPath || '');
    } catch {
      // Ignore storage errors and rely on OAuth state.
    }
  }, [effectiveIsJoinMode, effectivePreferredPath]);

  const consumeAuthIntent = (hashParams) => {
    const fromState = hashParams.get('state');
    const authIntentFromState = fromState === 'signup' || fromState === 'signin' ? fromState : '';

    let intent = '';
    let loginMode = '';
    let postLoginNext = '';
    try {
      intent = window.sessionStorage.getItem('ssm_auth_intent') || window.localStorage.getItem('ssm_auth_intent') || '';
      loginMode = window.sessionStorage.getItem('ssm_login_mode') || window.localStorage.getItem('ssm_login_mode') || '';
      postLoginNext = window.sessionStorage.getItem('ssm_post_login_next') || window.localStorage.getItem('ssm_post_login_next') || '';
      window.sessionStorage.removeItem('ssm_auth_intent');
      window.localStorage.removeItem('ssm_auth_intent');
      window.sessionStorage.removeItem('ssm_login_mode');
      window.localStorage.removeItem('ssm_login_mode');
      window.sessionStorage.removeItem('ssm_post_login_next');
      window.localStorage.removeItem('ssm_post_login_next');
    } catch {
      // Ignore storage errors and use defaults.
    }

    return {
      authIntent: authIntentFromState || (intent === 'signup' ? 'signup' : 'signin'),
      recoveredIsJoinMode: loginMode === 'join',
      recoveredPreferredPath: postLoginNext || ''
    };
  };

  const openRegistrationWithNotice = useCallback((user, profile, role, intent = 'signup', message = '') => {
    setNotice(message);
    setError('');
    setPendingRegistrationUser(user);
    resetRegistrationForm({
      name: user?.name || profile?.name || '',
      email: user?.email || profile?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      memberType: effectiveIsJoinMode || intent === 'signup'
        ? 'Member'
        : (user?.memberType || (role ? 'Admin' : 'Member'))
    });
  }, [effectiveIsJoinMode, resetRegistrationForm]);

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
        const { authIntent, recoveredIsJoinMode, recoveredPreferredPath } = consumeAuthIntent(hashParams);
        const callbackIsJoinMode = effectiveIsJoinMode || recoveredIsJoinMode;
        const callbackPreferredPath = effectivePreferredPath || recoveredPreferredPath;
        const callbackIsMemberContributorPath = MEMBER_CONTRIBUTOR_PATHS.includes(callbackPreferredPath);

        if (recoveredIsJoinMode || recoveredPreferredPath) {
          setOauthRedirectContext({
            isJoinMode: recoveredIsJoinMode,
            preferredPath: recoveredPreferredPath
          });
        }

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

        let activeIntent = authIntent;
        let response = null;
        try {
          response = await loginWithGoogle({
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.picture,
            intent: activeIntent
          });
        } catch (loginError) {
          if (activeIntent === 'signin' && loginError?.code === 'USER_NOT_REGISTERED') {
            activeIntent = 'signup';
            response = await loginWithGoogle({
              email: profile.email,
              name: profile.name,
              avatarUrl: profile.picture,
              intent: activeIntent
            });
          } else {
            throw loginError;
          }
        }

        if (cancelled) {
          return;
        }

        const role = response?.data?.user?.role;
        if (activeIntent === 'signup') {
          if (response?.data?.wasExistingUser) {
            const approvalMessage = getApprovalMessage(response?.data?.user, role);
            if (approvalMessage) {
              setNotice(approvalMessage);
              return;
            }

            if (callbackPreferredPath.startsWith('/admin') && !role && !callbackIsMemberContributorPath) {
              setError('This Google account does not have admin access.');
              return;
            }

            navigate(resolvePostLoginPath(callbackPreferredPath, role, callbackIsJoinMode), { replace: true });
            return;
          }

          openRegistrationWithNotice(response?.data?.user, profile, role, activeIntent);
          return;
        }

        const approvalMessage = getApprovalMessage(response?.data?.user, role);
        if (approvalMessage) {
          setNotice(approvalMessage);
          return;
        }

        if (callbackPreferredPath.startsWith('/admin') && !role && !callbackIsMemberContributorPath) {
          navigate(resolveMemberContributorPath(callbackPreferredPath), { replace: true });
          return;
        }

        navigate(resolvePostLoginPath(callbackPreferredPath, role, callbackIsJoinMode), { replace: true });
      } catch (err) {
        if (!cancelled) {
          if (err?.code === 'USER_NOT_REGISTERED' && profile?.email) {
            openRegistrationWithNotice({
              name: profile.name,
              email: profile.email,
              phone: '',
              address: '',
              avatarUrl: profile.picture,
              memberType: 'Member'
            }, profile, null, 'signup', 'Please register first and fill all the pending information as well.');
            return;
          }
          setError('Google sign-in failed. Please try again.');
        }
      }
    };

    completeGoogleRedirect();

    return () => {
      cancelled = true;
    };
  }, [effectiveIsJoinMode, effectivePreferredPath, loginWithGoogle, navigate, openRegistrationWithNotice]);

  const handleGoogleSignIn = useCallback(async (intent = 'signin') => {
    setError('');
    setNotice('');
    if (intent === 'signin') {
      setPendingRegistrationUser(null);
    }

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
      let activeIntent = intent;
      let response = null;
      try {
        response = await loginWithGoogle({ intent: activeIntent });
      } catch (loginError) {
        if (activeIntent === 'signin' && loginError?.code === 'USER_NOT_REGISTERED') {
          activeIntent = 'signup';
          response = await loginWithGoogle({ intent: activeIntent });
        } else {
          throw loginError;
        }
      }

      const role = response?.data?.user?.role;
      if (activeIntent === 'signup') {
        if (response?.data?.wasExistingUser) {
          const approvalMessage = getApprovalMessage(response?.data?.user, role);
          if (approvalMessage) {
            setNotice(approvalMessage);
            return;
          }

          if (effectivePreferredPath.startsWith('/admin') && !role && !isMemberContributorPath) {
            setError('This Google account does not have admin access.');
            return;
          }

          navigate(resolvePostLoginPath(effectivePreferredPath, role, effectiveIsJoinMode), { replace: true });
          return;
        }

        openRegistrationWithNotice(response?.data?.user, null, role, activeIntent);
        return;
      }

      const approvalMessage = getApprovalMessage(response?.data?.user, role);
      if (approvalMessage) {
        setNotice(approvalMessage);
        return;
      }

      if (effectivePreferredPath.startsWith('/admin') && !role && !isMemberContributorPath) {
        navigate(resolveMemberContributorPath(effectivePreferredPath), { replace: true });
        return;
      }

      navigate(resolvePostLoginPath(effectivePreferredPath, role, effectiveIsJoinMode), { replace: true });
    } catch (err) {
      if (err?.code === 'USER_NOT_REGISTERED') {
        setError('Please register first and fill all the pending information as well.');
        return;
      }
      setError('Google sign-in failed. Please try again.');
    }
  }, [allowMockGoogleLogin, effectiveIsJoinMode, effectivePreferredPath, isMemberContributorPath, loginWithGoogle, navigate, openRegistrationWithNotice, persistAuthIntent]);

  const onCompleteRegistration = async (values) => {
    setError('');
    setNotice('');
    const safeMemberType = 'Member';

    try {
      const response = await completeRegistration({
        ...values,
        memberType: safeMemberType,
        avatarUrl: pendingRegistrationUser?.avatarUrl || ''
      });

      const role = response?.data?.user?.role;
      setPendingRegistrationUser(null);

      const approvalMessage = getApprovalMessage(response?.data?.user, role);
      if (approvalMessage) {
        setNotice(approvalMessage);
        return;
      }

      if (effectivePreferredPath.startsWith('/admin') && !role && !isMemberContributorPath) {
        navigate(resolveMemberContributorPath(effectivePreferredPath), { replace: true });
        return;
      }

      navigate(resolvePostLoginPath(effectivePreferredPath, role, effectiveIsJoinMode), { replace: true });
    } catch {
      setError('Unable to save registration details. Please try again.');
    }
  };

  useEffect(() => {
    const hasOAuthToken = (window.location.hash || '').includes('access_token=');
    if (hasOAuthToken || autoOAuthTriggered) {
      return;
    }

    const intent = effectiveIsJoinMode ? 'signup' : 'signin';
    setAutoOAuthTriggered(true);
    handleGoogleSignIn(intent);
  }, [autoOAuthTriggered, effectiveIsJoinMode, handleGoogleSignIn]);

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero
        title={effectiveIsJoinMode ? 'Join The Sangat' : 'Secure Sign In'}
        description={effectiveIsJoinMode
          ? 'Redirecting to Google OAuth before opening your registration form.'
          : 'Redirecting to Google OAuth. Please wait...'}
      />

      <Card className="mx-auto max-w-md">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-brand-blue" />
          <p className="text-sm font-semibold text-slate-800">
            {effectiveIsJoinMode ? 'Preparing volunteer join flow...' : 'Redirecting to Google sign-in...'}
          </p>
          <p className="text-xs text-slate-500">Please wait while we securely continue the authentication flow.</p>
          {!authService.getGoogleOAuthUrl() ? (
            <p className="text-xs text-slate-500">Google OAuth URL not detected. Restart the app after updating .env.local. Mock Google login fallback is enabled.</p>
          ) : null}
        </div>
        {notice ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
        {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </Card>

      {pendingRegistrationUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setPendingRegistrationUser(null)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl font-semibold">Complete Registration</h3>
                <p className="mt-1 text-sm text-slate-600">Please confirm your details to continue.</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingRegistrationUser(null)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close registration modal"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={registrationForm.handleSubmit(onCompleteRegistration)}>
              <label className="text-sm">Name
                <input {...registrationForm.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Email
                <input type="email" {...registrationForm.register('email', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Phone
                <input {...registrationForm.register('phone', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>

              <label className="text-sm">Role
                <input value="Member" readOnly className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5" />
              </label>

              <label className="text-sm md:col-span-2">Address
                <input {...registrationForm.register('address', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>

              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Saving...' : 'Register and Continue'}</Button>
                <Button type="button" variant="ghost" onClick={() => setPendingRegistrationUser(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LoginPage;
