import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from './database';
import { notesRepo } from './notesRepo';
import { tasksRepo } from './tasksRepo';
import { eventsRepo } from './eventsRepo';
import { canvasRepo } from './repos/canvasRepo';
import { snippetsRepo } from './repos/snippetsRepo';

describe('Tag sanitization across repositories', () => {
  beforeEach(async () => {
    await db.notes.clear();
    await db.tasks.clear();
    await db.events.clear();
    await db.canvases.clear();
    await db.snippets.clear();
  });

  it('notesRepo sanitizes tags on creation and update', async () => {
    const note = await notesRepo.createNote({
      title: 'Test Note',
      content: 'Content',
      tags: ['#PROJECT', 'hello world', 'tag!'],
    });

    expect(note.tags).toEqual(['project', 'hello-world', 'tag']);

    await notesRepo.updateNote(note.id!, {
      tags: ['#NEW_TAG', 'another tag', '#PROJECT'],
    });

    const updated = await notesRepo.getNoteById(note.id!);
    expect(updated?.tags).toEqual(['new_tag', 'another-tag', 'project']);
  });

  it('tasksRepo sanitizes tags on creation and update', async () => {
    const task = await tasksRepo.createTask({
      title: 'Test Task',
      tags: ['#Urgent!', 'WORK', 'urgent'],
    });

    expect(task.tags).toEqual(['urgent', 'work']);

    await tasksRepo.updateTask(task.id!, {
      tags: ['#FollowUp', 'CLIENT@WORK'],
    });

    const updated = await tasksRepo.getTaskById(task.id!);
    expect(updated?.tags).toEqual(['followup', 'client-work']);
  });

  it('eventsRepo sanitizes tags on creation and update', async () => {
    const event = await eventsRepo.createEvent({
      title: 'Planning Session',
      startAt: new Date(),
      allDay: false,
      recurrence: 'none',
      tags: ['#Meeting!', 'Q1 Review'],
    });

    expect(event.tags).toEqual(['meeting', 'q1-review']);

    await eventsRepo.updateEvent(event.id!, {
      tags: ['#UpdatedTag', 'meeting'],
    });

    const updated = await eventsRepo.getEventById(event.id!);
    expect(updated?.tags).toEqual(['updatedtag', 'meeting']);
  });

  it('canvasRepo sanitizes tags on creation and update', async () => {
    const canvas = await canvasRepo.createCanvas({
      title: 'Sketch 1',
      tags: ['#ArtWork', 'Design System'],
    });

    expect(canvas.tags).toEqual(['artwork', 'design-system']);

    await canvasRepo.updateCanvasMetadata(canvas.id!, {
      tags: ['#Wireframe/V1', 'art-work'],
    });

    const updated = await canvasRepo.getCanvasById(canvas.id!);
    expect(updated?.tags).toEqual(['wireframe/v1', 'art-work']);
  });

  it('snippetsRepo sanitizes tags on creation and update', async () => {
    const snippet = await snippetsRepo.create({
      trigger: 'email',
      expansion: 'test@example.com',
      tags: ['#ContactInfo', 'Work Tag'],
    });

    expect(snippet.tags).toEqual(['contactinfo', 'work-tag']);

    await snippetsRepo.update(snippet.id!, {
      tags: ['#Personal/Email', 'contact-info'],
    });

    const updated = await snippetsRepo.getByTrigger('#email');
    expect(updated?.tags).toEqual(['personal/email', 'contact-info']);
  });
});
