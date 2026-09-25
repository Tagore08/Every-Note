import React, { useState, useEffect, useMemo } from 'react';
import { Sheet } from '../../design/ui/Sheet';
import { TemplatePickerSheet } from '../templates/TemplatePickerSheet';
import { parseQuickAdd } from '../../lib/quickAdd';
import { notesRepo } from '../../db/notesRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { eventsRepo } from '../../db/eventsRepo';
import { peopleRepo } from '../../db/peopleRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import type { Note } from '../../types/note';
import type { Template } from '../../types/template';

export interface FileAsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
  onFiled?: () => void;
}

export function FileAsSheet({ isOpen, onClose, note, onFiled }: FileAsSheetProps) {
  const { showUndo } = useSnackbar();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [isSubtasksOpen, setIsSubtasksOpen] = useState(false);
  const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever note changes
  useEffect(() => {
    if (note) {
      const initialTitle =
        note.title ||
        (note.content ? note.content.split('\n')[0].replace(/^#+\s*/, '').trim() : '');
      setTitle(initialTitle);
      setContent(note.content || '');
      setTags(note.tags ?? []);
      setSubtasks([]);
      setIsSubtasksOpen(false);
    }
  }, [note]);

  // Real-time NLP parsing
  const nlp = useMemo(() => {
    return parseQuickAdd(title);
  }, [title]);

  if (!note) return null;

  // Add subtask
  const handleAddSubtask = () => {
    const trimmed = subtaskInput.trim();
    if (!trimmed) return;
    setSubtasks((prev) => [...prev, trimmed]);
    setSubtaskInput('');
  };

  const handleSubtaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtask();
    }
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

  // Add tag
  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Apply template
  const handleApplyTemplate = (tmpl: Template) => {
    if (tmpl.body.title && !title) {
      setTitle(tmpl.body.title);
    }
    if (tmpl.body.content) {
      setContent((prev) => (prev ? `${prev}\n\n${tmpl.body.content}` : tmpl.body.content!));
    }
    if (tmpl.body.subtasks && tmpl.body.subtasks.length > 0) {
      setSubtasks((prev) => [...prev, ...tmpl.body.subtasks!]);
      setIsSubtasksOpen(true);
    }
    if (tmpl.body.tags && tmpl.body.tags.length > 0) {
      setTags((prev) => Array.from(new Set([...prev, ...tmpl.body.tags!])));
    }
  };

  // 1. File as Note
  const handleFileAsNote = async () => {
    if (!note.id || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const finalTitle = (nlp.title || title || 'Untitled Note').trim();
      const finalTags = Array.from(new Set([...tags, ...nlp.tags]));

      await notesRepo.updateNote(note.id, {
        title: finalTitle,
        content,
        tags: finalTags,
        inbox: false,
      });

      const noteId = note.id;
      showUndo('Filed as note', async () => {
        await notesRepo.updateNote(noteId, { inbox: true });
      });

      onClose();
      onFiled?.();
    } catch (err) {
      console.error('Failed to file as note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Convert to Task
  const handleConvertToTask = async () => {
    if (!note.id || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const finalTitle = (nlp.title || title || 'New Task').trim();
      const finalTags = Array.from(new Set([...tags, ...nlp.tags]));

      const newTask = await tasksRepo.createTask({
        title: finalTitle,
        description: content,
        dueAt: nlp.dueAt ?? null,
        tags: finalTags,
        priority: 'medium',
      });

      // Materialize subtasks if any
      if (newTask.id && subtasks.length > 0) {
        for (const st of subtasks) {
          await tasksRepo.createSubtask(newTask.id, st);
        }
      }

      // Mark original inbox note as filed / cleared
      const originalNoteId = note.id;
      await notesRepo.fileInboxNote(originalNoteId);

      showUndo('Converted to task', async () => {
        if (newTask.id) {
          await tasksRepo.deletePermanently(newTask.id);
        }
        await notesRepo.updateNote(originalNoteId, { inbox: true });
      });

      onClose();
      onFiled?.();
    } catch (err) {
      console.error('Failed to convert to task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Convert to Event
  const handleConvertToEvent = async () => {
    if (!note.id || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const finalTitle = (nlp.title || title || 'New Event').trim();
      const finalTags = Array.from(new Set([...tags, ...nlp.tags]));
      const startAt = nlp.dueAt ?? new Date();
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // 1 hour default

      const newEvent = await eventsRepo.createEvent({
        title: finalTitle,
        description: content,
        startAt,
        endAt,
        allDay: false,
        recurrence: 'none',
        reminderAt: null,
        tags: finalTags,
        trashedAt: null,
      });

      const originalNoteId = note.id;
      await notesRepo.fileInboxNote(originalNoteId);

      showUndo('Converted to event', async () => {
        if (newEvent.id) {
          await eventsRepo.deletePermanently(newEvent.id);
        }
        await notesRepo.updateNote(originalNoteId, { inbox: true });
      });

      onClose();
      onFiled?.();
    } catch (err) {
      console.error('Failed to convert to event:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Convert to Person
  const handleConvertToPerson = async () => {
    if (!note.id || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const personName = (title || content.split('\n')[0] || 'New Person').trim();
      const notesBody = content || (title ? '' : 'Captured from inbox');

      const newPerson = await peopleRepo.createPerson({
        name: personName,
        notes: notesBody,
      });

      const originalNoteId = note.id;
      await notesRepo.fileInboxNote(originalNoteId);

      showUndo('Converted to person', async () => {
        if (newPerson.id) {
          await peopleRepo.deletePermanently(newPerson.id);
        }
        await notesRepo.updateNote(originalNoteId, { inbox: true });
      });

      onClose();
      onFiled?.();
    } catch (err) {
      console.error('Failed to convert to person:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Delete / Trash
  const handleDelete = async () => {
    if (!note.id || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const noteId = note.id;
      await notesRepo.trashNote(noteId);
      showUndo('Moved to trash', async () => {
        await notesRepo.restoreNote(noteId);
      });
      onClose();
      onFiled?.();
    } catch (err) {
      console.error('Failed to trash note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title="Triage Inbox Item"
        description="Organize with tags, subtasks, or convert to a task."
      >
        <div className="space-y-4">
          {/* Title Field */}
          <div>
            <label htmlFor="file-as-title" className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
              Title
            </label>
            <input
              id="file-as-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Schedule dentist appointment tomorrow @Health #routine"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />

            {/* Quick-add NLP preview chips */}
            {nlp.previewLabel && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-accent bg-accent-soft px-2.5 py-1.5 rounded-lg border border-accent/20">
                <span className="font-semibold shrink-0">🪄 Detected:</span>
                <span className="truncate">{nlp.previewLabel}</span>
              </div>
            )}
          </div>

          {/* Template Bar */}
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsTemplateSheetOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-border bg-surface-2 hover:bg-surface text-xs font-semibold text-ink transition-colors cursor-pointer min-h-[36px]"
            >
              <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Apply Template</span>
            </button>
          </div>

          {/* Tags Section */}
          <div>
            <label htmlFor="file-as-tag-input" className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-medium bg-surface-2 text-ink border border-border"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-danger cursor-pointer ml-0.5"
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="file-as-tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag and press Enter..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface-2 hover:bg-surface text-xs font-semibold text-ink cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Add Subtasks Disclosure */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setIsSubtasksOpen(!isSubtasksOpen)}
              className="w-full px-3 py-2.5 flex items-center justify-between bg-surface-2/50 hover:bg-surface-2 text-xs font-semibold text-ink transition-colors cursor-pointer min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <span>Subtasks {subtasks.length > 0 ? `(${subtasks.length})` : ''}</span>
              </div>
              <svg
                className={`w-3.5 h-3.5 transform transition-transform ${isSubtasksOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isSubtasksOpen && (
              <div className="p-3 bg-surface space-y-2 border-t border-border">
                {subtasks.length > 0 && (
                  <ul className="space-y-1.5">
                    {subtasks.map((st, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 p-2 rounded-md bg-surface-2/60 text-xs text-ink"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                          <span>{st}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtask(i)}
                          className="text-ink-muted hover:text-danger cursor-pointer p-1"
                          aria-label="Remove subtask"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyDown={handleSubtaskKeyDown}
                    placeholder="Add a checklist subtask..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubtask}
                    className="px-3 py-1.5 rounded-lg border border-border bg-surface-2 hover:bg-surface text-xs font-semibold text-ink cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Note content preview */}
          <div>
            <label htmlFor="file-as-content" className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
              Content / Notes
            </label>
            <textarea
              id="file-as-content"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Additional content or description..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-accent resize-none font-mono"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-pill text-xs font-semibold text-danger hover:bg-danger-soft transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
            </button>

            <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleConvertToEvent}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-pill border border-border bg-surface-2 hover:bg-surface text-xs font-semibold text-ink transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 shadow-xs"
                title="Convert to Calendar Event"
              >
                <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>To Event</span>
              </button>

              <button
                type="button"
                onClick={handleConvertToPerson}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-pill border border-border bg-surface-2 hover:bg-surface text-xs font-semibold text-ink transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 shadow-xs"
                title="Convert to Person"
              >
                <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>To Person</span>
              </button>

              <button
                type="button"
                onClick={handleConvertToTask}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-pill border border-border bg-surface-2 hover:bg-surface text-xs font-semibold text-ink transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 shadow-xs"
              >
                <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <span>To Task</span>
              </button>

              <button
                type="button"
                onClick={handleFileAsNote}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 shadow-card"
              >
                <span>File as Note</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </Sheet>

      {/* Nested Template Picker */}
      <TemplatePickerSheet
        isOpen={isTemplateSheetOpen}
        onClose={() => setIsTemplateSheetOpen(false)}
        onSelectTemplate={handleApplyTemplate}
      />
    </>
  );
}
