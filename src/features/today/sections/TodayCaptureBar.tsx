import { useState } from 'react';
import { notesRepo } from '../../../db/notesRepo';
import { useSnackbar } from '../../../context/SnackbarContext';

export function TodayCaptureBar() {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showUndo } = useSnackbar();

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newNote = await notesRepo.createNote({
        title: '',
        content: text,
        inbox: true,
        tags: [],
      });

      setContent('');
      showUndo('Captured to Inbox', async () => {
        if (newNote.id) await notesRepo.trashNote(newNote.id);
      });
    } catch (err) {
      console.error('Failed to capture note from Today bar:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      data-testid="today-capture-bar"
      onSubmit={handleCapture}
      className="sticky bottom-2 sm:bottom-4 z-20 flex items-center gap-2 p-1.5 sm:p-2 rounded-pill bg-surface/90 backdrop-blur-md border border-border shadow-float"
    >
      <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0 text-base font-bold ml-1">
        ＋
      </div>

      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Capture anything to Inbox…"
        className="flex-1 px-2 py-2 text-xs sm:text-sm bg-transparent text-ink placeholder:text-ink-muted focus:outline-hidden"
      />

      <button
        type="submit"
        disabled={!content.trim() || isSubmitting}
        className="px-3.5 py-1.5 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shrink-0 min-h-[36px]"
      >
        Capture
      </button>
    </form>
  );
}
