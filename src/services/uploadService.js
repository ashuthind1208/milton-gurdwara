import apiClient from './apiClient';

const toDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Unable to read selected file.'));
  reader.readAsDataURL(file);
});

const normalizeService = (service) => String(service || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

const toMimeMatcher = (pattern = '') => {
  const safePattern = String(pattern || '').trim().toLowerCase();
  if (!safePattern) {
    return () => true;
  }

  if (safePattern.endsWith('/*')) {
    const prefix = safePattern.slice(0, -1);
    return (mime) => String(mime || '').toLowerCase().startsWith(prefix);
  }

  return (mime) => String(mime || '').toLowerCase() === safePattern;
};

const isAllowedMime = (mimeType, allowedMimeTypes = []) => {
  if (!Array.isArray(allowedMimeTypes) || allowedMimeTypes.length === 0) {
    return true;
  }

  return allowedMimeTypes.some((pattern) => toMimeMatcher(pattern)(mimeType));
};

const getUploadErrorMessage = (error) => {
  const statusCode = Number(error?.response?.status || 0);
  const serverMessage = String(error?.response?.data?.message || '').trim();

  if (statusCode === 404) {
    return 'Upload endpoint was not found (404). Please restart the app server so new upload routes are loaded.';
  }

  if (serverMessage) {
    return serverMessage;
  }

  return String(error?.message || 'Upload failed. Please try again.');
};

const uploadService = {
  uploadFile: async ({ service, file, allowedMimeTypes = [], maxSizeMB = 15, onProgress }) => {
    const normalizedService = normalizeService(service);
    if (!normalizedService) {
      throw new Error('Upload service is required.');
    }

    if (!file) {
      throw new Error('Please select a file to upload.');
    }

    if (!isAllowedMime(file.type, allowedMimeTypes)) {
      throw new Error(`Unsupported file type: ${file.type || 'unknown'}.`);
    }

    const maxBytes = Math.max(1, Number(maxSizeMB || 15)) * 1024 * 1024;
    if (Number(file.size || 0) > maxBytes) {
      throw new Error(`File is too large. Maximum allowed size is ${maxSizeMB} MB.`);
    }

    try {
      const dataUrl = await toDataUrl(file);
      const response = await apiClient.post(
        `/uploads/${encodeURIComponent(normalizedService)}`,
        {
          fileName: file.name,
          mimeType: file.type,
          dataUrl
        },
        {
          timeout: 120000,
          onUploadProgress: (event) => {
            if (typeof onProgress !== 'function') {
              return;
            }

            const total = Number(event?.total || 0);
            const loaded = Number(event?.loaded || 0);
            if (!total || total <= 0) {
              return;
            }

            const percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
            onProgress(percent);
          }
        }
      );

      return response.data?.data || null;
    } catch (error) {
      throw new Error(getUploadErrorMessage(error));
    }
  }
};

export default uploadService;
