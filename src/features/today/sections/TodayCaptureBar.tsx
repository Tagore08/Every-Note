import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notesRepo } from '../../../db/notesRepo';
import { tasksRepo } from '../../../db/tasksRepo';
import { attachmentsRepo } from '../../../db/attachmentsRepo';
import { canvasRepo } from '../../../db/repos/canvasRepo';
import { useSnackbar } from '../../../context/SnackbarContext';
import { useSnippetAutocomplete } from '../../snippets/useSnippetAutocomplete';
import { SnippetSuggestPill } from '../../snippets/SnippetSuggestPill';

interface TodayCaptureBarProps {
  className?: string;
}

export function TodayCaptureBar({
  className = "sticky top-2 z-20 p-2.5 rounded-2xl bg-surface/96 backdrop-blur-xl border border-border/60 shadow-card transition-all"
}: TodayCaptureBarProps = {}) {
  const navigate = useNavigate();
  const { showUndo, showSnackbar } = useSnackbar();

  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const textInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    hasMatches: hasSnippetMatches,
    matchingSnippets,
    applySnippet,
    handleKeyDown: handleSnippetKeyDown,
  } = useSnippetAutocomplete({
    value: content,
    onChange: setContent,
    inputRef: textInputRef,
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // 1. Text Capture -> Inbox Note
  const handleCaptureText = async (e: React.FormEvent) => {
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
      console.error('Failed to capture note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Task Toggle -> Create Task directly to Inbox
  const handleCaptureTask = async () => {
    const text = content.trim();
    setIsSubmitting(true);
    try {
      const title = text || 'Quick Task';
      const newTask = await tasksRepo.createTask({
        title,
        status: 'todo',
        priority: 'none',
        tags: ['inbox'],
      });

      setContent('');
      showUndo('Task created in Inbox', async () => {
        if (newTask.id) await tasksRepo.deletePermanently(newTask.id);
      });
    } catch (err) {
      console.error('Failed to create quick task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Image Toggle -> Create Inbox Note with Image Attachment
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsSubmitting(true);
    try {
      const newNote = await notesRepo.createNote({
        title: `Captured Image — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        content: content.trim(),
        inbox: true,
        tags: ['image'],
      });

      if (newNote.id) {
        for (let i = 0; i < files.length; i++) {
          await attachmentsRepo.addFileAttachment(newNote.id, files[i]);
        }
      }

      setContent('');
      showUndo('Image captured to Inbox', async () => {
        if (newNote.id) await notesRepo.trashNote(newNote.id);
      });
    } catch (err) {
      console.error('Failed to capture image to inbox:', err);
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 4. Voice Recording Toggle -> Record audio, save to Inbox
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showSnackbar({ message: 'Audio recording is not supported in this browser' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        if (audioBlob.size > 0) {
          try {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const newNote = await notesRepo.createNote({
              title: `Voice Note — ${timeStr}`,
              content: content.trim() || 'Recorded voice note',
              inbox: true,
              tags: ['voice'],
            });

            if (newNote.id) {
              await attachmentsRepo.addBlobAttachment(
                newNote.id,
                audioBlob,
                `voice-${Date.now()}.webm`,
                mediaRecorder.mimeType || 'audio/webm',
                'file'
              );
            }

            setContent('');
            showUndo('Voice recording saved to Inbox', async () => {
              if (newNote.id) await notesRepo.trashNote(newNote.id);
            });
          } catch (err) {
            console.error('Failed to save voice recording:', err);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone permission denied or recording failed:', err);
      showSnackbar({ message: 'Microphone access denied' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      showSnackbar({ message: 'Voice recording discarded' });
    }
  };

  // 5. Drawing Toggle -> Create blank canvas & open
  const handleDrawing = async () => {
    try {
      const canvas = await canvasRepo.createCanvas({
        title: `Drawing — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        tags: ['inbox'],
      });
      navigate(`/canvas/${canvas.id}`);
    } catch (err) {
      console.error('Failed to start canvas drawing:', err);
    }
  };

  return (
    <div
      data-testid="today-capture-bar"
      className={className}
    >
      {/* Hidden file input for Image toggle */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageSelect}
        className="hidden"
      />

      {isRecording ? (
        /* Recording Voice Mode Active */
        <div className="flex items-center justify-between gap-3 px-2 py-1">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span className="text-xs font-semibold text-rose-500">
              Recording Voice ({Math.floor(recordingSeconds / 60)}:
              {String(recordingSeconds % 60).padStart(2, '0')})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1.5 rounded-pill text-xs font-medium text-[var(--color-ink-muted)] hover:text-rose-500 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-1.5 rounded-pill bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-xs cursor-pointer min-h-[36px]"
            >
              Save to Inbox
            </button>
          </div>
        </div>
      ) : (
        /* Standard Quick-Capture Strip with 5 Toggles */
        <form onSubmit={handleCaptureText} className="flex flex-col items-stretch gap-1.5">
          {hasSnippetMatches && (
            <SnippetSuggestPill
              snippets={matchingSnippets}
              onSelect={applySnippet}
            />
          )}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2 w-full flex-1">
              <div className="w-7 h-7 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center shrink-0 text-sm font-bold">
                ＋
              </div>

              <input
                ref={textInputRef}
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleSnippetKeyDown}
                placeholder="Capture anything to Inbox… (#snippet for text expansion)"
                className="flex-1 px-1 py-1.5 text-xs sm:text-sm bg-transparent text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none"
              />

              {content.trim() && (
                <button
                type="submit"
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-pill bg-[var(--color-accent)] text-[var(--color-accent-ink)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0 min-h-[36px]"
              >
                Save
              </button>
            )}
          </div>

          {/* Quick Toggles: Text, Task, Image, Voice, Drawing */}
          <div className="flex items-center gap-1 self-end sm:self-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-[var(--color-border)]/60 sm:pl-2 sm:border-l">
            {/* Task toggle */}
            <button
              type="button"
              onClick={handleCaptureTask}
              title="Create Task in Inbox"
              className="p-2 rounded-xl text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </button>

            {/* Image toggle */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach Image to Inbox"
              className="p-2 rounded-xl text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>

            {/* Audio / Voice toggle */}
            <button
              type="button"
              onClick={startRecording}
              title="Record Voice Note to Inbox"
              className="p-2 rounded-xl text-[var(--color-ink-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>

            {/* Drawing toggle */}
            <button
              type="button"
              onClick={handleDrawing}
              title="New Drawing to Inbox"
              className="p-2 rounded-xl text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </button>
          </div>
        </div>
      </form>
      )}
    </div>
  );
}
