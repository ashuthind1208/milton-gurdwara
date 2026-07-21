export const getGenericErrorMessage = (status, fallbackMessage = 'An unexpected error occurred. Please try again later.') => {
  switch (Number(status)) {
    case 400:
      return 'The request was invalid. Please check the entered details.';
    case 401:
      return 'You are not signed in. Please sign in and try again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested item was not found.';
    case 413:
      return 'The request was too large. Please reduce the file size or input.';
    case 429:
      return 'Too many requests. Please wait and try again.';
    default:
      return fallbackMessage;
  }
};

export const logErrorDetails = (scope, error, extra = {}) => {
  // Keep the sensitive details in the browser console for debugging only.
  // The UI should use the generic message returned by getGenericErrorMessage.
  console.error(`[${scope}]`, {
    message: error?.message || 'Unknown error',
    stack: error?.stack || '',
    status: error?.response?.status || error?.status || null,
    responseData: error?.response?.data || null,
    ...extra
  });
};

export const normalizeErrorMessage = (error, fallbackMessage, scope = 'request') => {
  const status = error?.response?.status || error?.status || error?.statusCode || 500;
  logErrorDetails(scope, error, { status });
  return getGenericErrorMessage(status, fallbackMessage);
};
