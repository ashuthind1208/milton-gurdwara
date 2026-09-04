import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import {
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  StarIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import askGranthiService from '../../services/askGranthiService';

const statusStyles = {
  answered: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  thinking: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-800'
};

const AdminAskGranthiPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [viewingQuestion, setViewingQuestion] = useState(null);
  const [deletingQuestion, setDeletingQuestion] = useState(null);
  const [questionsPage, setQuestionsPage] = useState(1);
  const QUESTIONS_PER_PAGE = 10;

  const { data: questions = [], isLoading, isError } = useQuery({
    queryKey: ['admin-ask-granthi-questions'],
    queryFn: () => askGranthiService.getQuestions().then((response) => response.data),
    refetchInterval: 5000,
    refetchOnWindowFocus: true
  });

  const refreshQuestions = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-ask-granthi-questions'] });
    queryClient.invalidateQueries({ queryKey: ['ask-granthi-board'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => askGranthiService.updateQuestion(id, values),
    onSuccess: () => {
      refreshQuestions();
      setEditingQuestion(null);
      setEditValues(null);
    }
  });
  const quickUpdateMutation = useMutation({
    mutationFn: ({ id, values }) => askGranthiService.updateQuestion(id, values),
    onSuccess: refreshQuestions
  });
  const retryMutation = useMutation({
    mutationFn: (id) => askGranthiService.retryQuestion(id),
    onSuccess: refreshQuestions
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => askGranthiService.removeQuestion(id),
    onSuccess: refreshQuestions
  });

  useEffect(() => {
    setHeaderAction(
      <AdminHeaderActionButton label="Open LED Board" onClick={() => window.open('/ask-a-granthi?screen=welcome', '_blank', 'noopener,noreferrer')} />
    );
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  const filteredQuestions = useMemo(() => questions.filter((entry) => statusFilter === 'all' || entry.status === statusFilter), [questions, statusFilter]);
  const totalQuestionPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE));
  const pagedQuestions = useMemo(() => filteredQuestions.slice((questionsPage - 1) * QUESTIONS_PER_PAGE, questionsPage * QUESTIONS_PER_PAGE), [filteredQuestions, questionsPage]);

  useEffect(() => {
    setQuestionsPage((page) => Math.min(page, totalQuestionPages));
  }, [totalQuestionPages]);
  const metrics = useMemo(() => ({
    total: questions.length,
    answered: questions.filter((entry) => entry.status === 'answered').length,
    featured: questions.filter((entry) => entry.featured).length,
    errors: questions.filter((entry) => entry.status === 'error').length
  }), [questions]);

  const openEditor = (entry) => {
    setEditingQuestion(entry);
    setEditValues({
      question: entry.question || '',
      shortAnswer: entry.shortAnswer || '',
      answerPunjabi: entry.answerPunjabi || '',
      answerEnglish: entry.answerEnglish || '',
      category: entry.category || 'Sikh Learning',
      featured: Boolean(entry.featured),
      visible: entry.visible !== false
    });
  };

  const submitEdit = (event) => {
    event.preventDefault();
    updateMutation.mutate({ id: editingQuestion.id, values: editValues });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-slate-900">Ask a Granthi</h1>
          <p className="mt-1 text-sm text-slate-600">Review saved AI answers, choose frequently asked questions, and control what appears on the LED board.</p>
        </div>
        <a href="/ask-a-granthi/question" target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-brand-blue hover:bg-slate-50">Open QR question screen</a>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Saved questions', metrics.total, 'text-brand-blue'],
          ['Answered', metrics.answered, 'text-emerald-700'],
          ['Featured FAQs', metrics.featured, 'text-amber-700'],
          ['Needs attention', metrics.errors, 'text-red-700']
        ].map(([label, value, tone]) => (
          <Card key={label} className="rounded-lg p-4 hover:translate-y-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter questions by status">
        {['all', 'answered', 'thinking', 'error'].map((status) => (
          <button key={status} type="button" onClick={() => { setStatusFilter(status); setQuestionsPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${statusFilter === status ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{status}</button>
        ))}
      </div>

      {isLoading ? <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading saved questions...</p> : null}
      {isError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Unable to load Ask a Granthi questions.</p> : null}
      {!isLoading && filteredQuestions.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No questions match this filter yet.</p> : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_120px_330px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 md:grid">
          <span>Question</span><span>Answer summary</span><span>Status</span><span className="text-right">Actions</span>
        </div>
        {pagedQuestions.map((entry) => (
          <article key={entry.id} className="border-b border-slate-200 px-4 py-3 last:border-b-0">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_120px_330px] md:items-center">
              <h2 className="min-w-0 truncate font-semibold text-slate-900" title={entry.question}>{entry.question}</h2>
              <span className="min-w-0 truncate text-xs text-slate-500" title={entry.status === 'answered' ? `${entry.answerPunjabi || '-'} | ${entry.answerEnglish || '-'}` : entry.errorMessage || 'Answer pending'}>{entry.status === 'answered' ? `ਪੰ: ${entry.answerPunjabi || '-'} · En: ${entry.answerEnglish || '-'}` : entry.errorMessage || 'Answer pending'}</span>
              <div className="hidden md:block"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${statusStyles[entry.status] || statusStyles.error}`}>{entry.status}</span></div>
              <div className="flex shrink-0 flex-nowrap items-center justify-start gap-1.5 md:justify-end">
                <button type="button" onClick={() => setViewingQuestion(entry)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><EyeIcon className="h-4 w-4" /> View</button>
                {entry.status === 'answered' ? (
                  <>
                    <button type="button" onClick={() => quickUpdateMutation.mutate({ id: entry.id, values: { featured: !entry.featured } })} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50" aria-label={entry.featured ? 'Remove from frequently asked questions' : 'Feature as frequently asked question'} title={entry.featured ? 'Unfeature' : 'Feature'}><StarIcon className="h-5 w-5" /></button>
                    <button type="button" onClick={() => quickUpdateMutation.mutate({ id: entry.id, values: { visible: entry.visible === false } })} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50" aria-label={entry.visible === false ? 'Show on LED board' : 'Hide from LED board'} title={entry.visible === false ? 'Show' : 'Hide'}>{entry.visible === false ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}</button>
                    <button type="button" onClick={() => openEditor(entry)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50" aria-label="Edit question and answer" title="Edit"><PencilSquareIcon className="h-5 w-5" /></button>
                  </>
                ) : null}
                {entry.status === 'error' ? <button type="button" onClick={() => retryMutation.mutate(entry.id)} disabled={retryMutation.isPending} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" aria-label="Retry AI answer" title="Retry"><ArrowPathIcon className="h-5 w-5" /></button> : null}
                <button type="button" onClick={() => deleteMutation.mutate(entry.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50" aria-label="Delete question" title="Delete"><TrashIcon className="h-5 w-5" /></button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {filteredQuestions.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>Showing {(questionsPage - 1) * QUESTIONS_PER_PAGE + 1}-{Math.min(questionsPage * QUESTIONS_PER_PAGE, filteredQuestions.length)} of {filteredQuestions.length}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setQuestionsPage((page) => Math.max(1, page - 1))} disabled={questionsPage === 1} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
          <span className="font-semibold">Page {questionsPage} of {totalQuestionPages}</span>
          <button type="button" onClick={() => setQuestionsPage((page) => Math.min(totalQuestionPages, page + 1))} disabled={questionsPage === totalQuestionPages} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next</button>
        </div>
      </div> : null}

      {viewingQuestion ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="presentation" onClick={() => setViewingQuestion(null)}>
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="ask-granthi-view-title" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-blue">Saved question</p><h2 id="ask-granthi-view-title" className="mt-1 font-heading text-xl font-semibold text-slate-900">{viewingQuestion.question}</h2></div><button type="button" onClick={() => setViewingQuestion(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300" aria-label="Close question preview"><XMarkIcon className="h-5 w-5" /></button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Punjabi</p><p className="mt-1 whitespace-pre-wrap font-gurmukhi text-sm leading-6 text-slate-800">{viewingQuestion.answerPunjabi || 'No Punjabi answer yet.'}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">English</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{viewingQuestion.answerEnglish || 'No English answer yet.'}</p></div></div>
          </section>
        </div>
      ) : null}

      {deletingQuestion ? (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="presentation" onClick={() => setDeletingQuestion(null)}>
          <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="ask-granthi-delete-title" onClick={(event) => event.stopPropagation()}><h2 id="ask-granthi-delete-title" className="font-heading text-xl font-semibold text-slate-900">Delete this question?</h2><p className="mt-2 text-sm leading-6 text-slate-600">This will remove the saved question and its answer from the admin list and LED board.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeletingQuestion(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(deletingQuestion.id); setDeletingQuestion(null); }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{deleteMutation.isPending ? 'Deleting...' : 'Delete question'}</button></div></section>
        </div>
      ) : null}

      {editingQuestion && editValues ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full items-center justify-center">
            <form onSubmit={submitEdit} className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-blue">Review stored answer</p>
                  <h2 className="mt-1 font-heading text-xl font-semibold text-slate-900">Edit question and answer</h2>
                </div>
                <button type="button" onClick={() => setEditingQuestion(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700" aria-label="Close editor"><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <div className="mt-5 grid gap-4">
                <label className="text-sm font-semibold text-slate-700">Question
                  <textarea value={editValues.question} onChange={(event) => setEditValues((previous) => ({ ...previous, question: event.target.value }))} rows={2} required minLength={8} maxLength={500} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-700">Short answer
                  <input value={editValues.shortAnswer} onChange={(event) => setEditValues((previous) => ({ ...previous, shortAnswer: event.target.value }))} required maxLength={120} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-700">Punjabi answer
                  <textarea value={editValues.answerPunjabi} onChange={(event) => setEditValues((previous) => ({ ...previous, answerPunjabi: event.target.value }))} rows={4} required maxLength={700} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-gurmukhi font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-700">English answer
                  <textarea value={editValues.answerEnglish} onChange={(event) => setEditValues((previous) => ({ ...previous, answerEnglish: event.target.value }))} rows={4} required maxLength={700} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-700">Category
                  <input value={editValues.category} onChange={(event) => setEditValues((previous) => ({ ...previous, category: event.target.value }))} required maxLength={80} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal" />
                </label>
                <div className="flex flex-wrap gap-5">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={editValues.featured} onChange={(event) => setEditValues((previous) => ({ ...previous, featured: event.target.checked }))} /> Featured FAQ</label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={editValues.visible} onChange={(event) => setEditValues((previous) => ({ ...previous, visible: event.target.checked }))} /> Visible on LED board</label>
                </div>
              </div>
              {updateMutation.isError ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{updateMutation.error?.message}</p> : null}
              <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setEditingQuestion(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save answer'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminAskGranthiPage;