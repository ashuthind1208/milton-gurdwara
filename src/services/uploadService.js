import apiClient from './apiClient';

const toDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Unable to read selected file.'));
  reader.readAsDataURL(file);
});

const toArrayBuffer = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Unable to read selected file.'));
  reader.readAsArrayBuffer(blob);
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

const detectFileMimeType = async (file) => {
  const buffer = await toArrayBuffer(file.slice(0, 16));
  const bytes = new Uint8Array(buffer || []);

  if (bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4E
    && bytes[3] === 0x47
    && bytes[4] === 0x0D
    && bytes[5] === 0x0A
    && bytes[6] === 0x1A
    && bytes[7] === 0x0A) {
    return 'image/png';
  }

  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }

  if (bytes.length >= 6) {
    const header = String.fromCharCode(...bytes.slice(0, 6));
    if (header === 'GIF87a' || header === 'GIF89a') {
      return 'image/gif';
    }
  }

  if (bytes.length >= 12) {
    const riff = String.fromCharCode(...bytes.slice(0, 4));
    const webp = String.fromCharCode(...bytes.slice(8, 12));
    if (riff === 'RIFF' && webp === 'WEBP') {
      return 'image/webp';
    }

    const atomType = String.fromCharCode(...bytes.slice(4, 8));
    if (atomType === 'ftyp') {
      const brand = String.fromCharCode(...bytes.slice(8, 12)).trim().toLowerCase();
      if (brand === 'qt' || brand.startsWith('qt')) {
        return 'video/quicktime';
      }
      if (brand.startsWith('mp4') || brand.startsWith('isom') || brand.startsWith('iso2') || brand.startsWith('avc1') || brand.startsWith('m4v')) {
        return 'video/mp4';
      }
    }
  }

  if (bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
    return 'video/webm';
  }

  if (bytes.length >= 5) {
    const header = String.fromCharCode(...bytes.slice(0, 5));
    if (header === '%PDF-') {
      return 'application/pdf';
    }
  }

  if (!bytes.includes(0x00)) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (String(text || '').trim().length > 0) {
      return 'text/plain';
    }
  }

  return '';
};

const isExecutableLikeMime = (mimeType) => {
  const normalized = String(mimeType || '').toLowerCase();
  return normalized === 'image/svg+xml'
    || normalized === 'text/html'
    || normalized === 'application/xhtml+xml'
    || normalized === 'application/xml'
    || normalized === 'text/xml'
    || normalized === 'application/javascript'
    || normalized === 'text/javascript';
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

    const maxBytes = Math.max(1, Number(maxSizeMB || 15)) * 1024 * 1024;
    if (Number(file.size || 0) > maxBytes) {
      throw new Error(`File is too large. Maximum allowed size is ${maxSizeMB} MB.`);
    }

    const detectedMimeType = await detectFileMimeType(file);
    if (!detectedMimeType || isExecutableLikeMime(detectedMimeType)) {
      throw new Error('Unsupported file type.');
    }

    if (detectedMimeType !== String(file.type || '').toLowerCase()) {
      throw new Error('File content does not match the selected file type.');
    }

    if (!isAllowedMime(detectedMimeType, allowedMimeTypes)) {
      throw new Error(`Unsupported file type: ${detectedMimeType || 'unknown'}.`);
    }

    try {
      const dataUrl = await toDataUrl(file);
      const response = await apiClient.post(
        `/uploads/${encodeURIComponent(normalizedService)}`,
        {
          fileName: file.name,
          mimeType: detectedMimeType,
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
