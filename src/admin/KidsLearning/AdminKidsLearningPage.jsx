import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import kidsLearningService from '../../services/kidsLearningService';
import kidsQuizBankService from '../../services/kidsQuizBankService';

const resolveCorrectIndex = (question = {}) => {
  const options = Array.isArray(question.options) ? question.options : [];
  const raw = Number(question.correctAnswer);
  if (Number.isFinite(raw) && raw >= 0 && raw < options.length) {
    return raw;
  }
  if (Number.isFinite(raw) && raw >= 1 && raw <= options.length) {
    return raw - 1;
  }
  return 0;
};

const normalizeQuestionDraft = (question = {}) => {
  const options = Array.isArray(question.options) ? question.options : [];
  const normalizedOptions = [...options, ...Array.from({ length: Math.max(0, 4 - options.length) }, () => ({ en: '', pa: '' }))].slice(0, 4);
  return {
    ...question,
    question: {
      en: String(question?.question?.en || ''),
      pa: String(question?.question?.pa || '')
    },
    options: normalizedOptions.map((entry) => ({ en: String(entry?.en || ''), pa: String(entry?.pa || '') })),
    explanation: {
      en: String(question?.explanation?.en || ''),
      pa: String(question?.explanation?.pa || '')
    },
    reference: {
      en: String(question?.reference?.en || ''),
      pa: String(question?.reference?.pa || '')
    },
    difficulty: String(question?.difficulty || 'Easy'),
    category: String(question?.category || 'Sikh Learning'),
    points: Number(question?.points || 10),
    image: question?.image || null,
    correctAnswer: resolveCorrectIndex(question)
  };
};

const normalizeWeekKey = (value = '') => String(value || '').trim().toLowerCase();

const toCanonicalWeekKey = (value = '', weekOptions = []) => {
  const normalized = normalizeWeekKey(value);
  if (!normalized) {
    return '';
  }

  if (weekOptions.some((option) => normalizeWeekKey(option) === normalized)) {
    return normalized;
  }

  if (normalized === 'current week') {
    return normalizeWeekKey(weekOptions[0] || value);
  }
  if (normalized === 'last week') {
    return normalizeWeekKey(weekOptions[1] || value);
  }

  const weeksAgoMatch = normalized.match(/^(\d+)\s+weeks?\s+ago$/);
  if (weeksAgoMatch) {
    const weekIndex = Number(weeksAgoMatch[1]);
    if (Number.isFinite(weekIndex) && weekIndex >= 0 && weekIndex < weekOptions.length) {
      return normalizeWeekKey(weekOptions[weekIndex]);
    }
  }

  return normalized;
};

const normalizeWeekLabel = (value = '', weekOptions = []) => {
  const canonicalKey = toCanonicalWeekKey(value, weekOptions);
  const matched = weekOptions.find((option) => normalizeWeekKey(option) === canonicalKey);
  if (matched) {
    return matched;
  }
  return String(value || '').trim();
};

const dedupeWeeklyWords = (items = [], weekOptions = []) => {
  const seen = new Set();
  const result = [];

  items.forEach((entry, index) => {
    const canonicalKey = toCanonicalWeekKey(entry?.week, weekOptions) || `row-${index}`;
    if (seen.has(canonicalKey)) {
      return;
    }
    seen.add(canonicalKey);
    result.push({
      ...entry,
      week: normalizeWeekLabel(entry?.week, weekOptions)
    });
  });

  return result;
};

const formatWeekRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const toLabel = (value) => {
    const month = value.toLocaleDateString('en-US', { month: 'short' });
    const day = String(value.getDate()).padStart(2, '0');
    return `${month}${day}`;
  };

  return `${toLabel(start)}-${toLabel(end)}`;
};

const buildWeekOptions = (count = 20) => {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() - (index * 7));
    return formatWeekRange(weekStart);
  });
};

const AdminKidsLearningPage = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [quizModal, setQuizModal] = useState({ open: false, fileName: '', mode: 'view' });
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [quizQuestionsDraft, setQuizQuestionsDraft] = useState([]);
  const [quizQuestionDraft, setQuizQuestionDraft] = useState(null);
  const [wordTableError, setWordTableError] = useState('');
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [wordModalMode, setWordModalMode] = useState('add');
  const [editingWordIndex, setEditingWordIndex] = useState(-1);
  const [newWeeklyWord, setNewWeeklyWord] = useState({
    week: '',
    punjabi: '',
    englishMeaning: ''
  });

  const { data } = useQuery({
    queryKey: ['kids-learning-content-admin'],
    queryFn: () => kidsLearningService.getContent().then((res) => res.data)
  });

  const { data: quizFiles = [] } = useQuery({
    queryKey: ['kids-quiz-files-admin'],
    queryFn: () => kidsQuizBankService.getQuizFiles().then((res) => res.data)
  });

  useEffect(() => {
    if (data) {
      setDraft(data);
    }
  }, [data]);

  const saveKidsLearningMutation = useMutation({
    mutationFn: (payload) => kidsLearningService.updateContent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kids-learning-content-admin'] });
      queryClient.invalidateQueries({ queryKey: ['kids-learning-content'] });
    }
  });

  const saveQuizFileMutation = useMutation({
    mutationFn: ({ fileName, questions }) => kidsQuizBankService.updateQuizFileQuestions(fileName, questions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kids-quiz-files-admin'] });
      queryClient.invalidateQueries({ queryKey: ['kids-quiz-bank-filesystem'] });
      if (quizModal.fileName) {
        queryClient.invalidateQueries({ queryKey: ['kids-quiz-file-admin', quizModal.fileName] });
      }
    }
  });

  const weeklyWords = useMemo(
    () => (Array.isArray(draft?.weeklyWords) ? draft.weeklyWords : []),
    [draft?.weeklyWords]
  );
  const weekOptions = useMemo(() => buildWeekOptions(20), []);
  const canonicalWeeklyWords = useMemo(
    () => dedupeWeeklyWords(weeklyWords, weekOptions),
    [weeklyWords, weekOptions]
  );
  const previousWeeklyWords = useMemo(() => canonicalWeeklyWords.slice(1), [canonicalWeeklyWords]);

  const saveFullDraft = (nextDraft) => {
    setDraft(nextDraft);
    saveKidsLearningMutation.mutate(nextDraft);
  };

  const syncWordCardFields = (items = []) => {
    const safeItems = Array.isArray(items) ? items : [];
    const current = safeItems[0] || null;
    return {
      wordOfWeek: {
        ...(draft?.wordOfWeek || {}),
        punjabi: current?.punjabi || '',
        transliteration: current?.transliteration || '',
        englishMeaning: current?.englishMeaning || ''
      },
      previousWordWeeks: safeItems.slice(1, 4).map((entry, index) => ({
        id: entry.id || `word-prev-${index + 1}`,
        punjabi: entry.punjabi || '',
        transliteration: entry.transliteration || '',
        englishMeaning: entry.englishMeaning || ''
      }))
    };
  };

  const openAddWordModal = () => {
    const firstAvailableWeek = weekOptions.find(
      (label) => !canonicalWeeklyWords.some(
        (entry) => toCanonicalWeekKey(entry?.week, weekOptions) === toCanonicalWeekKey(label, weekOptions)
      )
    ) || weekOptions[0] || '';
    setWordModalMode('add');
    setEditingWordIndex(-1);
    setNewWeeklyWord({ week: firstAvailableWeek, punjabi: '', englishMeaning: '' });
    setWordTableError('');
    setIsAddWordModalOpen(true);
  };

  const openEditWordModal = (index) => {
    const entry = canonicalWeeklyWords[index];
    if (!entry) {
      return;
    }
    setWordModalMode('edit');
    setEditingWordIndex(index);
    setNewWeeklyWord({
      week: String(entry.week || ''),
      punjabi: String(entry.punjabi || ''),
      englishMeaning: String(entry.englishMeaning || '')
    });
    setWordTableError('');
    setIsAddWordModalOpen(true);
  };

  const closeAddWordModal = () => {
    setIsAddWordModalOpen(false);
    setWordModalMode('add');
    setEditingWordIndex(-1);
    setWordTableError('');
  };

  const saveWeeklyWord = () => {
    const week = String(newWeeklyWord.week || '').trim();
    if (!week) {
      setWordTableError('Week is required before adding a word.');
      return;
    }

    const weekKey = toCanonicalWeekKey(week, weekOptions);
    const alreadyExists = canonicalWeeklyWords.some(
      (entry, index) => index !== editingWordIndex && toCanonicalWeekKey(entry?.week, weekOptions) === weekKey
    );
    if (alreadyExists) {
      setWordTableError(`A word already exists for "${week}".`);
      return;
    }

    const nextEntry = {
      id: canonicalWeeklyWords[editingWordIndex]?.id || `week-word-${Date.now()}`,
      week,
      punjabi: String(newWeeklyWord.punjabi || ''),
      transliteration: '',
      englishMeaning: String(newWeeklyWord.englishMeaning || '')
    };

    const nextWeeklyWords = wordModalMode === 'edit'
      ? canonicalWeeklyWords.map((entry, index) => (index === editingWordIndex ? nextEntry : entry))
      : [nextEntry, ...canonicalWeeklyWords];
    const nextPayload = {
      ...draft,
      weeklyWords: nextWeeklyWords,
      ...syncWordCardFields(nextWeeklyWords)
    };
    setDraft((current) => ({
      ...current,
      weeklyWords: nextWeeklyWords,
      ...syncWordCardFields(nextWeeklyWords)
    }));
    saveFullDraft(nextPayload);
    setNewWeeklyWord({ week: '', punjabi: '', englishMeaning: '' });
    setWordTableError('');
    setIsAddWordModalOpen(false);
    setWordModalMode('add');
    setEditingWordIndex(-1);
  };

  const openQuizEditor = async (fileName, mode) => {
    const response = await kidsQuizBankService.getQuizFileQuestions(fileName);
    const questions = Array.isArray(response.data) ? response.data : [];
    const safeQuestions = questions.map((entry) => normalizeQuestionDraft(entry));
    setQuizQuestionsDraft(safeQuestions);
    setSelectedQuestionIndex(0);
    setQuizQuestionDraft(safeQuestions[0] ? normalizeQuestionDraft(safeQuestions[0]) : null);
    setQuizModal({ open: true, fileName, mode });
  };

  const closeQuizModal = () => {
    setQuizModal({ open: false, fileName: '', mode: 'view' });
    setQuizQuestionsDraft([]);
    setSelectedQuestionIndex(0);
    setQuizQuestionDraft(null);
  };

  const commitCurrentQuestion = () => {
    if (!quizQuestionDraft) {
      return quizQuestionsDraft;
    }
    return quizQuestionsDraft.map((entry, index) => (
      index === selectedQuestionIndex ? normalizeQuestionDraft(quizQuestionDraft) : entry
    ));
  };

  const handleSelectQuestion = (nextIndex) => {
    const committed = commitCurrentQuestion();
    setQuizQuestionsDraft(committed);
    const safeIndex = Math.max(0, Math.min(committed.length - 1, nextIndex));
    setSelectedQuestionIndex(safeIndex);
    setQuizQuestionDraft(committed[safeIndex] ? normalizeQuestionDraft(committed[safeIndex]) : null);
  };

  const saveQuizFile = () => {
    if (!quizModal.fileName) {
      return;
    }
    const committed = commitCurrentQuestion();
    setQuizQuestionsDraft(committed);
    saveQuizFileMutation.mutate({ fileName: quizModal.fileName, questions: committed });
  };

  if (!draft) {
    return <p className="text-sm text-slate-600">Loading kids learning content...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="sr-only">Kids Learning</h1>
        <p className="text-sm text-slate-600">Manage word cards and quiz JSON files used by the flashcard section.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Word of the Week</h2>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => openEditWordModal(0)} disabled={canonicalWeeklyWords.length === 0}>Edit Current</Button>
            <Button type="button" variant="secondary" onClick={openAddWordModal}>Add Word</Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-600">Current week: <span className="font-semibold text-slate-800">{canonicalWeeklyWords[0]?.week || '-'}</span> | Punjabi: <span className="font-semibold text-slate-800">{canonicalWeeklyWords[0]?.punjabi || '-'}</span> | English: <span className="font-semibold text-slate-800">{canonicalWeeklyWords[0]?.englishMeaning || '-'}</span></p>
        {wordTableError ? <p className="mt-2 text-sm font-medium text-rose-600">{wordTableError}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Week</th>
                <th className="px-3 py-2">Punjabi</th>
                <th className="px-3 py-2">English</th>
              </tr>
            </thead>
            <tbody>
              {previousWeeklyWords.map((entry, index) => (
                <tr key={entry.id || `weekly-word-row-${index}`} className="border-b border-slate-100">
                  <td className="px-3 py-2">{entry.week || '-'}</td>
                  <td className="px-3 py-2">{entry.punjabi || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>{entry.englishMeaning || '-'}</span>
                      <button type="button" className="rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openEditWordModal(index + 1)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
              {previousWeeklyWords.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-center text-slate-500" colSpan={3}>No previous words available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {isAddWordModalOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 px-4" onClick={closeAddWordModal}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{wordModalMode === 'edit' ? 'Edit Word' : 'Add Word'}</h3>
              <button type="button" onClick={closeAddWordModal} className="rounded-full border border-slate-200 p-2 text-slate-600"><XMarkIcon className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block font-medium text-slate-700">Week
                <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={newWeeklyWord.week} onChange={(event) => setNewWeeklyWord((current) => ({ ...current, week: event.target.value }))}>
                  <option value="">Select week</option>
                  {weekOptions.map((weekLabel) => (
                    <option key={weekLabel} value={weekLabel}>{weekLabel}</option>
                  ))}
                </select>
              </label>
              <label className="block font-medium text-slate-700">English Content
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={newWeeklyWord.englishMeaning} onChange={(event) => setNewWeeklyWord((current) => ({ ...current, englishMeaning: event.target.value }))} />
              </label>
              <label className="block font-medium text-slate-700">Punjabi Content
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={newWeeklyWord.punjabi} onChange={(event) => setNewWeeklyWord((current) => ({ ...current, punjabi: event.target.value }))} />
              </label>
            </div>
            {wordTableError ? <p className="mt-3 text-sm font-medium text-rose-600">{wordTableError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeAddWordModal}>Cancel</Button>
              <Button type="button" onClick={saveWeeklyWord}>{wordModalMode === 'edit' ? 'Update' : 'Save'}</Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <h2 className="text-base font-bold text-slate-900">Quiz JSON Files (Filesystem)</h2>
        <p className="mt-1 text-xs text-slate-600">These files are loaded from public/quiz and used by the Library flashcard section.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Questions</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quizFiles.map((file) => (
                <tr key={file.fileName} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-800">{file.fileName}</td>
                  <td className="px-3 py-2 text-slate-700">{file.questionCount || 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openQuizEditor(file.fileName, 'view')} className="rounded-full border border-slate-200 p-1.5 text-slate-600"><EyeIcon className="h-4 w-4" /></button>
                      <button type="button" onClick={() => openQuizEditor(file.fileName, 'edit')} className="rounded-full border border-slate-200 p-1.5 text-slate-600"><PencilSquareIcon className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {quizFiles.length === 0 ? (
                <tr><td className="px-3 py-3 text-center text-slate-500" colSpan={3}>No quiz files found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {quizModal.open ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 px-4" onClick={closeQuizModal}>
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{quizModal.mode === 'edit' ? 'Edit' : 'View'} Quiz File: {quizModal.fileName}</h3>
              <button type="button" onClick={closeQuizModal} className="rounded-full border border-slate-200 p-2 text-slate-600"><XMarkIcon className="h-4 w-4" /></button>
            </div>

            {quizQuestionDraft ? (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleSelectQuestion(selectedQuestionIndex - 1)}
                        disabled={selectedQuestionIndex <= 0}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleSelectQuestion(selectedQuestionIndex + 1)}
                        disabled={selectedQuestionIndex >= quizQuestionsDraft.length - 1}
                      >
                        Next
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">Question {selectedQuestionIndex + 1} / {quizQuestionsDraft.length}</p>
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <label className="font-medium text-slate-700">Category
                      <input disabled={quizModal.mode !== 'edit'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={quizQuestionDraft.category || ''} onChange={(event) => setQuizQuestionDraft((current) => ({ ...current, category: event.target.value }))} />
                    </label>
                    <label className="font-medium text-slate-700">Difficulty
                      <select disabled={quizModal.mode !== 'edit'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={quizQuestionDraft.difficulty || 'Easy'} onChange={(event) => setQuizQuestionDraft((current) => ({ ...current, difficulty: event.target.value }))}>
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                      </select>
                    </label>
                    <label className="font-medium text-slate-700 md:col-span-2">Question (EN)
                      <textarea disabled={quizModal.mode !== 'edit'} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={quizQuestionDraft.question?.en || ''} onChange={(event) => setQuizQuestionDraft((current) => ({ ...current, question: { ...current.question, en: event.target.value } }))} />
                    </label>
                    <label className="font-medium text-slate-700 md:col-span-2">Question (PA)
                      <textarea disabled={quizModal.mode !== 'edit'} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={quizQuestionDraft.question?.pa || ''} onChange={(event) => setQuizQuestionDraft((current) => ({ ...current, question: { ...current.question, pa: event.target.value } }))} />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {quizQuestionDraft.options.map((option, index) => (
                      <div key={`quiz-option-${index}`} className="rounded-xl border border-slate-200 p-3 text-sm">
                        <p className="font-semibold text-slate-700">Option {index + 1}</p>
                        <input disabled={quizModal.mode !== 'edit'} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5" value={option.en || ''} onChange={(event) => setQuizQuestionDraft((current) => {
                          const next = [...current.options];
                          next[index] = { ...next[index], en: event.target.value };
                          return { ...current, options: next };
                        })} placeholder="English" />
                        <input disabled={quizModal.mode !== 'edit'} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5" value={option.pa || ''} onChange={(event) => setQuizQuestionDraft((current) => {
                          const next = [...current.options];
                          next[index] = { ...next[index], pa: event.target.value };
                          return { ...current, options: next };
                        })} placeholder="Punjabi" />
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <label className="font-medium text-slate-700">Correct Option
                      <select disabled={quizModal.mode !== 'edit'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={resolveCorrectIndex(quizQuestionDraft)} onChange={(event) => setQuizQuestionDraft((current) => ({ ...current, correctAnswer: Number(event.target.value) }))}>
                        <option value={0}>Option 1</option>
                        <option value={1}>Option 2</option>
                        <option value={2}>Option 3</option>
                        <option value={3}>Option 4</option>
                      </select>
                    </label>
                    <label className="font-medium text-slate-700">Points
                      <input disabled={quizModal.mode !== 'edit'} type="number" min={0} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={Number(quizQuestionDraft.points || 0)} onChange={(event) => setQuizQuestionDraft((current) => ({ ...current, points: Number(event.target.value || 0) }))} />
                    </label>
                    <label className="font-medium text-slate-700 md:col-span-2">Explanation (EN)
                      <textarea disabled={quizModal.mode !== 'edit'} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={quizQuestionDraft.explanation?.en || ''} onChange={(event) => setQuizQuestionDraft((current) => ({ ...current, explanation: { ...current.explanation, en: event.target.value } }))} />
                    </label>
                    <label className="font-medium text-slate-700 md:col-span-2">Explanation (PA)
                      <textarea disabled={quizModal.mode !== 'edit'} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={quizQuestionDraft.explanation?.pa || ''} onChange={(event) => setQuizQuestionDraft((current) => ({ ...current, explanation: { ...current.explanation, pa: event.target.value } }))} />
                    </label>
                  </div>
                </div>

                {quizModal.mode === 'edit' ? (
                  <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-slate-200 pt-3">
                    <Button type="button" variant="secondary" onClick={closeQuizModal}>Cancel</Button>
                    <Button type="button" onClick={saveQuizFile} disabled={saveQuizFileMutation.isPending}>Save Quiz File</Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500">No questions found in this file.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminKidsLearningPage;
