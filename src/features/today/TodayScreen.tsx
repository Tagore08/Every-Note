import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlag } from '../../app/flags';
import { localDateStr } from '../../lib/date';
import { useOccurrencesForRange } from '../../db/eventsRepo';
import { useTasksDueForRange } from '../../db/tasksRepo';
import { useActiveRoutines, useRunsForDate, routinesRepo } from '../../db/repos/routinesRepo';
import { NowNextCard } from './sections/NowNextCard';
import { RoutineCard } from './sections/RoutineCard';
import { ScheduleRail } from './sections/ScheduleRail';
import { DueTasksSection } from './sections/DueTasksSection';
import { HabitsRow } from './sections/HabitsRow';
import { TodayCaptureBar } from './sections/TodayCaptureBar';
import { JournalPromptSection } from '../journal/JournalPromptSection';
import { EventEditorModal } from '../../components/calendar/EventEditorModal';
import { TaskEditorModal } from '../../components/tasks/TaskEditorModal';
import type { EventOccurrence } from '../../types/event';
import type { Task } from '../../types/task';
import type { RoutineTimeOfDay } from '../../types/routine';

export function TodayScreen() {
  const navigate = useNavigate();
  const isRoutinesEnabled = useFlag('routines');
  const isJournalEnabled = useFlag('journal');

  // Trigger materialization on mount and date change
  const [currentDateStr, setCurrentDateStr] = useState(() => localDateStr());

  useEffect(() => {
    // Materialize routines for today
    routinesRepo.materializeRoutinesFor(currentDateStr).catch((err) => {
      console.error('Failed to materialize routines:', err);
    });

    // Minute check for midnight rollover
    const interval = setInterval(() => {
      const today = localDateStr();
      if (today !== currentDateStr) {
        setCurrentDateStr(today);
        routinesRepo.materializeRoutinesFor(today).catch(console.error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentDateStr]);

  // Determine current time of day & greeting
  const { greeting, timeOfDay, fullDateFormatted } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();

    let timeOfDay: RoutineTimeOfDay = 'morning';
    let greeting = 'Good morning';

    if (hour >= 12 && hour < 17) {
      timeOfDay = 'afternoon';
      greeting = 'Good afternoon';
    } else if (hour >= 17) {
      timeOfDay = 'evening';
      greeting = 'Good evening';
    }

    const fullDateFormatted = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    return { greeting, timeOfDay, fullDateFormatted };
  }, []);

  // Today's range bounds
  const { startOfToday, endOfToday, overdueStart } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    // Overdue tasks can date back 30 days
    const overdueStart = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

    return { startOfToday, endOfToday, overdueStart };
  }, []);

  // Reactive data streams
  const todayEvents = useOccurrencesForRange(startOfToday, endOfToday) ?? [];
  const dueAndOverdueTasks = useTasksDueForRange(overdueStart, endOfToday) ?? [];
  const activeRoutines = useActiveRoutines();
  const todayRuns = useRunsForDate(currentDateStr);

  // Modals for editing tapped items
  const [selectedOccurrence, setSelectedOccurrence] = useState<EventOccurrence | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const handleOpenEvent = useCallback((occ: EventOccurrence) => {
    setSelectedOccurrence(occ);
    setIsEventModalOpen(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  }, []);

  // Collapsible section state persisted across visits
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('today_collapsed_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleSection = useCallback((sectionKey: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] };
      try {
        localStorage.setItem('today_collapsed_sections', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <div data-testid="today-screen" className="max-w-3xl mx-auto space-y-5 pb-16">
      {/* 1. Greeting Header */}
      <div className="flex items-center justify-between pt-1 pb-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink leading-tight">
            {greeting} 👋
          </h1>
          <p className="text-xs text-ink-faint mt-1 font-medium">
            {fullDateFormatted}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="p-2.5 rounded-xl bg-surface border border-border/60 hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shadow-xs"
            title="Settings"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Top: Inbox Quick-Capture Strip */}
      <TodayCaptureBar />

      {/* 3. Middle: "Today" Overview */}
      {/* 3a. Now / Next Card */}
      <NowNextCard
        events={todayEvents}
        routines={activeRoutines}
        routineRuns={todayRuns}
        onOpenEvent={handleOpenEvent}
      />

      {/* 3b. Active Routine Card */}
      {isRoutinesEnabled && (
        <RoutineCard
          routines={activeRoutines}
          routineRuns={todayRuns}
          tasks={dueAndOverdueTasks}
          currentTimeOfDay={timeOfDay}
          isCollapsed={Boolean(collapsedSections.routines)}
          onToggleCollapse={() => toggleSection('routines')}
        />
      )}

      {/* 3c. Schedule Rail */}
      <ScheduleRail
        events={todayEvents}
        onOpenEvent={handleOpenEvent}
        isCollapsed={Boolean(collapsedSections.schedule)}
        onToggleCollapse={() => toggleSection('schedule')}
      />

      {/* 3d. Due & Overdue Tasks */}
      <DueTasksSection
        tasks={dueAndOverdueTasks}
        onEditTask={handleEditTask}
        isCollapsed={Boolean(collapsedSections.tasks)}
        onToggleCollapse={() => toggleSection('tasks')}
      />

      {/* 3e. Habits Row */}
      <HabitsRow
        isCollapsed={Boolean(collapsedSections.habits)}
        onToggleCollapse={() => toggleSection('habits')}
      />

      {/* 3f. Journal Prompt Section */}
      {isJournalEnabled && <JournalPromptSection />}

      {/* Event Editor Modal */}
      <EventEditorModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        occurrence={selectedOccurrence}
        defaultDate={new Date()}
      />

      {/* Task Editor Modal */}
      <TaskEditorModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={selectedTask}
        onDelete={() => setIsTaskModalOpen(false)}
      />
    </div>
  );
}
