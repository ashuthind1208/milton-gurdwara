import { useState } from 'react';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';

const difficultyClasses = (difficulty) => {
  if (difficulty === 'Hard') return 'border-rose-300 bg-rose-100 text-rose-800';
  if (difficulty === 'Medium') return 'border-amber-300 bg-amber-100 text-amber-900';
  return 'border-emerald-300 bg-emerald-100 text-emerald-800';
};

const AiQuizFlashcards = ({ publishedQuizId = '', publishedQuizzes = [] }) => {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const resetProgress = () => {
    setQuestionIndex(0);
    setSelectedOption(null);
    setIsFlipped(false);
    setAnsweredCount(0);
    setCorrectCount(0);
    setStreak(0);
    setBestStreak(0);
  };

  const activeQuiz = publishedQuizzes.find((entry) => String(entry.id) === String(publishedQuizId)) || publishedQuizzes[0] || null;

  const questions = Array.isArray(activeQuiz?.questions) ? activeQuiz.questions : [];
  const question = questions[questionIndex] || null;
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const progress = questions.length > 0 ? ((questionIndex + 1) / questions.length) * 100 : 0;

  const moveQuestion = (offset) => {
    if (questions.length === 0) return;
    setQuestionIndex((current) => (current + offset + questions.length) % questions.length);
    setSelectedOption(null);
    setIsFlipped(false);
  };

  const selectAnswer = (optionIndex) => {
    if (!question || isFlipped) return;
    const isCorrect = optionIndex === Number(question.correctAnswer);
    setSelectedOption(optionIndex);
    setIsFlipped(true);
    setAnsweredCount((current) => current + 1);
    if (isCorrect) {
      setCorrectCount((current) => current + 1);
      setStreak((current) => {
        const next = current + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-violet-700" aria-hidden="true" />
            <h4 className="text-lg font-bold text-slate-900">Sikh Learning Quiz</h4>
          </div>
          <p className="mt-1 text-xs text-slate-600">A bilingual quiz selected by the Gurdwara team.</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/90 px-2.5 py-1 text-xs font-black text-violet-900 shadow-sm">Score {score}/100</span>
      </div>

      {question ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white/80 px-2 py-1 font-semibold text-slate-700">Streak: {streak}</span>
            <span className="rounded-full bg-white/80 px-2 py-1 font-semibold text-slate-700">Best: {bestStreak}</span>
            <span className="rounded-full bg-white/80 px-2 py-1 font-semibold text-slate-700">Answered: {answeredCount}</span>
            <button type="button" onClick={resetProgress} className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-violet-300 bg-white text-violet-900" aria-label="Start over quiz" title="Start over">
              <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-700"><span>{questionIndex + 1} / {questions.length}</span><span>{Math.round(progress)}%</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/80"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} /></div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <p className="text-slate-600">{question.category}</p>
            <span className={`inline-flex rounded-full border px-2 py-0.5 font-black uppercase ${difficultyClasses(question.difficulty)}`}>{question.difficulty}</span>
          </div>

          <div className="mt-3" style={{ perspective: '1200px' }}>
            <div className="relative min-h-[340px] w-full transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div className="absolute inset-0 overflow-y-auto rounded-xl border border-violet-200 bg-white p-4" style={{ backfaceVisibility: 'hidden' }}>
                <div className="flex items-start justify-between gap-2">
                  <div><p className="text-sm font-bold text-slate-900">{question.question?.en}</p><p lang="pa" className="mt-1 font-gurmukhi text-sm leading-6 text-slate-600">{question.question?.pa}</p></div>
                  <div className="inline-flex shrink-0 gap-1">
                    <button type="button" onClick={() => moveQuestion(-1)} className="h-7 w-7 rounded border border-violet-300 bg-violet-50 text-violet-800" aria-label="Previous flashcard">&lt;</button>
                    <button type="button" onClick={() => moveQuestion(1)} className="h-7 w-7 rounded border border-violet-300 bg-violet-50 text-violet-800" aria-label="Next flashcard">&gt;</button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <button key={`${question.id}-${optionIndex}`} type="button" onClick={() => selectAnswer(optionIndex)} className="block w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-left text-sm text-slate-700 transition hover:border-violet-400 hover:bg-violet-50">
                      <span className="font-semibold">{option.en}</span><span lang="pa" className="ml-1 font-gurmukhi text-xs text-slate-600">({option.pa})</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="absolute inset-0 overflow-y-auto rounded-xl border border-violet-300 bg-violet-50 p-4" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <p className="text-sm font-black text-violet-900">Answer Revealed</p>
                <p className="mt-2 text-sm text-slate-800">Correct: {question.options?.[question.correctAnswer]?.en || '-'}</p>
                <p className={`mt-2 text-xs font-bold ${selectedOption === question.correctAnswer ? 'text-emerald-700' : 'text-rose-700'}`}>{selectedOption === question.correctAnswer ? 'Correct answer selected.' : `Wrong answer selected: ${question.options?.[selectedOption]?.en || '-'}`}</p>
                <p className="mt-3 text-sm text-slate-700">{question.explanation?.en}</p>
                <p lang="pa" className="mt-1 font-gurmukhi text-sm leading-6 text-slate-600">{question.explanation?.pa}</p>
                {question.reference?.en ? <p className="mt-3 text-xs text-slate-500">Reference: {question.reference.en}</p> : null}
                <div className="mt-4 flex justify-end"><button type="button" onClick={() => moveQuestion(1)} className="rounded border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-900">Next &gt;</button></div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-white/70 px-4 py-8 text-center"><p className="text-sm font-semibold text-slate-700">A quiz will appear here when the Gurdwara team publishes one.</p></div>
      )}
    </div>
  );
};

export default AiQuizFlashcards;