import apiClient from './apiClient';
import { serviceResponse } from './serviceResponse';

export const QUIZ_FILES = [
  '/quiz/001_guru_nanak.json',
  '/quiz/002_ten_gurus.json',
  '/quiz/003_khalsa_panj_pyare.json',
  '/quiz/004_five_ks_symbols.json',
  '/quiz/005_gurdwara_gurbani.json',
  '/quiz/006_sikh_history.json',
  '/quiz/007_sikh_values_festivals.json',
  '/quiz/008_mixed_review.json'
];

const normalizeQuestion = (item = {}, index = 0) => ({
  id: Number(item.id || index + 1),
  category: String(item.category || 'Sikh Learning'),
  difficulty: String(item.difficulty || 'Easy'),
  question: {
    en: String(item?.question?.en || ''),
    pa: String(item?.question?.pa || '')
  },
  options: Array.isArray(item.options)
    ? item.options.slice(0, 4).map((entry) => ({
      en: String(entry?.en || ''),
      pa: String(entry?.pa || '')
    }))
    : [],
  correctAnswer: Number.isFinite(Number(item.correctAnswer)) ? Number(item.correctAnswer) : 0,
  explanation: {
    en: String(item?.explanation?.en || ''),
    pa: String(item?.explanation?.pa || '')
  },
  reference: {
    en: String(item?.reference?.en || ''),
    pa: String(item?.reference?.pa || '')
  },
  points: Number(item.points || 10),
  image: item.image || null
});

const getFileNameFromPath = (path = '') => {
  const parts = String(path).split('/');
  return parts[parts.length - 1] || path;
};

const getFilesystemQuizFiles = async () => {
  const files = await Promise.all(
    QUIZ_FILES.map(async (path) => {
      try {
        const response = await fetch(path);
        if (!response.ok) {
          return {
            fileName: getFileNameFromPath(path),
            questionCount: 0
          };
        }
        const payload = await response.json().catch(() => []);
        const questionCount = Array.isArray(payload) ? payload.length : 0;
        return {
          fileName: getFileNameFromPath(path),
          questionCount
        };
      } catch {
        return {
          fileName: getFileNameFromPath(path),
          questionCount: 0
        };
      }
    })
  );

  return files;
};

const getPublicQuizPathByFileName = (fileName = '') => {
  const target = String(fileName || '').trim();
  if (!target) {
    return '';
  }

  const matched = QUIZ_FILES.find((entry) => getFileNameFromPath(entry) === target);
  return matched || `/quiz/${target}`;
};

const getQuestionsFromPublicQuizFile = async (fileName) => {
  const publicPath = getPublicQuizPathByFileName(fileName);
  if (!publicPath) {
    return [];
  }

  const response = await fetch(publicPath);
  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => []);
  const items = Array.isArray(payload) ? payload : [];
  return items.map((entry, index) => normalizeQuestion(entry, index));
};

const kidsQuizBankService = {
  getAllQuestions: async () => {
    const responses = await Promise.all(
      QUIZ_FILES.map(async (path) => {
        const response = await fetch(path);
        if (!response.ok) {
          return [];
        }
        const payload = await response.json().catch(() => []);
        return Array.isArray(payload) ? payload : [];
      })
    );

    const merged = responses.flat().map((entry, index) => normalizeQuestion(entry, index));
    return serviceResponse(merged);
  },

  getQuizFiles: async () => {
    try {
      const response = await apiClient.get('/quiz-bank');
      const apiFiles = Array.isArray(response.data?.data) ? response.data.data : [];
      if (apiFiles.length > 0) {
        return serviceResponse(apiFiles);
      }
    } catch {
      // Fallback to public/quiz files when backend quiz-bank route is unavailable.
    }

    const filesystemFiles = await getFilesystemQuizFiles();
    return serviceResponse(filesystemFiles);
  },

  getQuizFileQuestions: async (fileName) => {
    try {
      const response = await apiClient.get(`/quiz-bank/${encodeURIComponent(fileName)}`);
      const items = Array.isArray(response.data?.data?.questions) ? response.data.data.questions : [];
      return serviceResponse(items.map((entry, index) => normalizeQuestion(entry, index)));
    } catch (error) {
      if (error?.response?.status === 404 || error?.code === 'ERR_NETWORK') {
        // If the backend route is missing/unavailable, read from public quiz files.
        const fallbackItems = await getQuestionsFromPublicQuizFile(fileName);
        return serviceResponse(fallbackItems);
      }
      throw error;
    }
  },

  updateQuizFileQuestions: async (fileName, questions = []) => {
    const response = await apiClient.put(`/quiz-bank/${encodeURIComponent(fileName)}`, { questions });
    const items = Array.isArray(response.data?.data?.questions) ? response.data.data.questions : [];
    return serviceResponse(items.map((entry, index) => normalizeQuestion(entry, index)));
  }
};

export default kidsQuizBankService;