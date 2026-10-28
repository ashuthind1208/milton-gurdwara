import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FloatingAskGranthi from './FloatingAskGranthi';
import askGranthiService from '../../services/askGranthiService';

jest.mock('../../services/askGranthiService', () => ({
  __esModule: true,
  default: { askQuestion: jest.fn() }
}));

jest.mock('../../context/BrandingContext', () => ({
  useBranding: () => ({ branding: { primaryColor: '#0B4EA2', accentColor: '#F4A300' } })
}));

const renderAssistant = () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><FloatingAskGranthi /></QueryClientProvider>);
};

test('shows a floating Granthi button and opens the question modal', async () => {
  renderAssistant();
  expect(screen.getByRole('button', { name: 'Ask a Granthi Ji a question' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Ask a Granthi Ji a question' }));
  expect(screen.getByRole('dialog', { name: 'Ask a Granthi Ji' })).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveClass('granthi-modal-card-in');
  expect(screen.getByTestId('granthi-modal-backdrop')).toHaveClass('granthi-modal-backdrop-in');
  expect(screen.getByLabelText('Your question')).toHaveFocus();
});

test('keeps only the avatar fixed bottom-right and ignores an old saved drag position', () => {
  window.localStorage.setItem('ssm-floating-ask-granthi-position-v1', JSON.stringify({ left: 80, top: 90 }));
  renderAssistant();
  const widget = screen.getByTestId('floating-granthi-widget');
  expect(widget).toHaveClass('fixed', 'right-4', 'bottom-[max(1rem,env(safe-area-inset-bottom))]');
  expect(widget.style.left).toBe('');
  expect(screen.queryByText('Questions about Sikhi')).not.toBeInTheDocument();
  expect(screen.queryByText('Ask a Granthi Ji')).not.toBeInTheDocument();
  window.localStorage.removeItem('ssm-floating-ask-granthi-position-v1');
});

test('keeps a normal pointer click on the avatar opening the popup', async () => {
  const originalPointerEvent = window.PointerEvent;
  window.PointerEvent = MouseEvent;
  try {
    renderAssistant();
    const button = screen.getByRole('button', { name: 'Ask a Granthi Ji a question' });
    button.setPointerCapture = jest.fn();
    button.releasePointerCapture = jest.fn();
    fireEvent.pointerDown(button, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(button, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 40, clientY: 40 });
    await userEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Ask a Granthi Ji' })).toBeInTheDocument();
  } finally {
    if (originalPointerEvent) window.PointerEvent = originalPointerEvent;
    else delete window.PointerEvent;
  }
});

test('submits a question and displays the bilingual response and Gurbani reference', async () => {
  askGranthiService.askQuestion.mockResolvedValue({
    data: {
      question: 'What is the meaning of Ik Onkar?',
      answerPunjabi: 'ਇਕ ਓਅੰਕਾਰ ਦਾ ਅਰਥ ਹੈ ਇੱਕ ਪਰਮਾਤਮਾ।',
      answerEnglish: 'Ik Onkar means there is one universal creator.',
      gurbani: {
        gurmukhi: 'ੴ ਸਤਿ ਨਾਮੁ',
        source: 'Mool Mantar',
        translationPunjabi: 'ਇੱਕ ਪਰਮਾਤਮਾ ਸੱਚਾ ਹੈ।',
        translationEnglish: 'There is one God, whose name is Truth.'
      }
    }
  });
  renderAssistant();
  await userEvent.click(screen.getByRole('button', { name: 'Ask a Granthi Ji a question' }));
  await userEvent.type(screen.getByLabelText('Your question'), 'What is the meaning of Ik Onkar?');
  await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
  expect(await screen.findByText('Ik Onkar means there is one universal creator.')).toBeInTheDocument();
  expect(screen.getByText('ਇਕ ਓਅੰਕਾਰ ਦਾ ਅਰਥ ਹੈ ਇੱਕ ਪਰਮਾਤਮਾ।')).toBeInTheDocument();
  expect(screen.getByText('Mool Mantar')).toBeInTheDocument();
  expect(askGranthiService.askQuestion).toHaveBeenCalledWith('What is the meaning of Ik Onkar?');
});

test('closes on Escape and allows asking another question', async () => {
  askGranthiService.askQuestion.mockResolvedValue({ data: { question: 'A sample question', answerPunjabi: 'ਪੰਜਾਬੀ ਜਵਾਬ', answerEnglish: 'English answer' } });
  renderAssistant();
  await userEvent.click(screen.getByRole('button', { name: 'Ask a Granthi Ji a question' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Ask a Granthi Ji a question' }));
  await userEvent.type(screen.getByLabelText('Your question'), 'A sample question');
  await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
  expect(await screen.findByText('English answer')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Ask another question' }));
  expect(screen.getByLabelText('Your question')).toBeInTheDocument();
});

test('explains when the server has no Ask a Granthi AI configuration', async () => {
  askGranthiService.askQuestion.mockRejectedValue({
    response: { status: 503, data: { message: 'Ask a Granthi AI is not configured yet.' } },
    message: 'Unable to complete the request right now.'
  });
  renderAssistant();
  await userEvent.click(screen.getByRole('button', { name: 'Ask a Granthi Ji a question' }));
  await userEvent.type(screen.getByLabelText('Your question'), 'What is the meaning of Ik Onkar?');
  await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/AI service is not configured/i);
});
