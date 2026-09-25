import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlag } from '../../app/flags';
import { localDateStr } from '../../lib/date';
import { useOccurrencesForRange } from '../../db/eventsRepo';
import { useTasksDueForRange } from '../../db/tasksRepo';
import { useActiveRoutines, useRunsForDate, routinesRepo } from '../../db/repos/routinesRepo';
import { useActiveAreas } from '../../db/repos/areasRepo';
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
import type { LifeArea } from '../../types/area';

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
  const activeAreas = useActiveAreas();

  const areasMap = useMemo(() => {
    const map = new Map<number, LifeArea>();
    for (const a of activeAreas) {
      if (a.id) map.set(a.id, a);
    }
    return map;
  }, [activeAreas]);

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

  return (
    <div data-testid="today-screen" className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* 1. Greeting Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
            {greeting}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5 font-medium">
            {fullDateFormatted}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Settings"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* 2. Now / Next Card */}
      <NowNextCard
        events={todayEvents}
        routines={activeRoutines}
        routineRuns={todayRuns}
        onOpenEvent={handleOpenEvent}
      />

      {/* 3. Routine Card (Active Routine for Today) */}
      {isRoutinesEnabled && (
        <RoutineCard
          routines={activeRoutines}
          routineRuns={todayRuns}
          tasks={dueAndOverdueTasks}
          currentTimeOfDay={timeOfDay}
        />
      )}

      {/* 4. Schedule Rail */}
      <ScheduleRail
        events={todayEvents}
        areasMap={areasMap}
        onOpenEvent={handleOpenEvent}
      />

      {/* 5. Due & Overdue Tasks */}
      <DueTasksSection
        tasks={dueAndOverdueTasks}
        areasMap={areasMap}
        onEditTask={handleEditTask}
      />

      {/* 6. Habits Row */}
      <HabitsRow />

      {/* 7. Journal Prompt Section */}
      {isJournalEnabled && <JournalPromptSection />}

      {/* 8. Sticky Quick-Capture Bar */}
      <TodayCaptureBar />

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
