import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SnackbarProvider } from './context/SnackbarContext';
import { AppShell } from './app/AppShell';
import { PageSkeleton } from './design/ui/Skeleton';
import { templatesRepo } from './db/repos/templatesRepo';
import { linksRepo } from './db/repos/linksRepo';
import { timerPresetsRepo } from './db/repos/timerPresetsRepo';
import { FocusTimerProvider } from './features/focus/FocusTimerContext';

// Code-split all feature views using React.lazy per EXPANSION_PLAN §6 & §7
const TodayView = lazy(() =>
  import('./features/today/TodayScreen').then((m) => ({ default: m.TodayScreen }))
);
const InsightsScreen = lazy(() =>
  import('./features/insights/InsightsScreen').then((m) => ({ default: m.InsightsScreen }))
);
const RoutinesScreen = lazy(() =>
  import('./features/routines/RoutinesScreen').then((m) => ({ default: m.RoutinesScreen }))
);
const InboxView = lazy(() =>
  import('./components/views/InboxView').then((m) => ({ default: m.InboxView }))
);
const NotesView = lazy(() =>
  import('./components/views/NotesView').then((m) => ({ default: m.NotesView }))
);
const NoteEditorView = lazy(() =>
  import('./components/views/NoteEditorView').then((m) => ({ default: m.NoteEditorView }))
);
const CanvasListScreen = lazy(() =>
  import('./features/canvas/CanvasListScreen').then((m) => ({ default: m.CanvasListScreen }))
);
const CanvasEditor = lazy(() =>
  import('./features/canvas/CanvasEditor').then((m) => ({ default: m.CanvasEditor }))
);
const GraphScreen = lazy(() =>
  import('./features/graph/GraphScreen').then((m) => ({ default: m.GraphScreen }))
);
const TasksView = lazy(() =>
  import('./components/views/TasksView').then((m) => ({ default: m.TasksView }))
);
const CalendarView = lazy(() =>
  import('./components/views/CalendarView').then((m) => ({ default: m.CalendarView }))
);
const FocusTimerView = lazy(() =>
  import('./components/views/FocusTimerView').then((m) => ({ default: m.FocusTimerView }))
);
const HabitsView = lazy(() =>
  import('./components/views/HabitsView').then((m) => ({ default: m.HabitsView }))
);
const HabitDetailScreen = lazy(() =>
  import('./features/habits/HabitDetailScreen').then((m) => ({ default: m.HabitDetailScreen }))
);
const PeopleView = lazy(() =>
  import('./components/views/PeopleView').then((m) => ({ default: m.PeopleView }))
);
const PersonProfileView = lazy(() =>
  import('./components/views/PersonProfileView').then((m) => ({
    default: m.PersonProfileView,
  }))
);
const SearchView = lazy(() =>
  import('./components/views/SearchView').then((m) => ({ default: m.SearchView }))
);
const TagsView = lazy(() =>
  import('./components/views/TagsView').then((m) => ({ default: m.TagsView }))
);
const TemplatesScreen = lazy(() =>
  import('./features/templates/TemplatesScreen').then((m) => ({ default: m.TemplatesScreen }))
);
const JournalScreen = lazy(() =>
  import('./features/journal/JournalScreen').then((m) => ({ default: m.JournalScreen }))
);
const ArchiveView = lazy(() =>
  import('./components/views/ArchiveView').then((m) => ({ default: m.ArchiveView }))
);
const TrashView = lazy(() =>
  import('./components/views/TrashView').then((m) => ({ default: m.TrashView }))
);
const SettingsView = lazy(() =>
  import('./components/views/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const LabsScreen = lazy(() =>
  import('./features/settings/LabsScreen').then((m) => ({ default: m.LabsScreen }))
);
const MigrateDebugScreen = lazy(() =>
  import('./features/debug/MigrateDebugScreen').then((m) => ({
    default: m.MigrateDebugScreen,
  }))
);
const SeedDebugScreen = lazy(() =>
  import('./features/debug/SeedDebugScreen').then((m) => ({
    default: m.SeedDebugScreen,
  }))
);

export function App() {
  useEffect(() => {
    // Seed defaults for Templates and Timer Presets idempotently on first load
    templatesRepo.seedDefaults().catch((err) => console.error('Failed to seed templates:', err));
    timerPresetsRepo.seedDefaults().catch((err) => console.error('Failed to seed timer presets:', err));
    linksRepo.ensureInitialReindex().catch((err) => console.error('Failed to ensure links reindex:', err));
  }, []);

  return (
    <SnackbarProvider>
      <FocusTimerProvider>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route element={<AppShell />}>
              {/* New primary home: /today */}
              <Route index element={<Navigate to="/today" replace />} />
              <Route path="today" element={<TodayView />} />

              {/* Old route redirection per EXPANSION_PLAN §3.2 */}
              <Route path="upcoming" element={<Navigate to="/today" replace />} />

              {/* Primary features */}
              <Route path="inbox" element={<InboxView />} />
              <Route path="journal" element={<JournalScreen />} />
              <Route path="journal/:date" element={<JournalScreen />} />
              <Route path="notes" element={<NotesView />} />
              <Route path="notes/:id" element={<NoteEditorView />} />
              <Route path="canvas" element={<CanvasListScreen />} />
              <Route path="canvas/:id" element={<CanvasEditor />} />
              <Route path="graph" element={<GraphScreen />} />
              <Route path="graph/:noteId" element={<GraphScreen />} />
              <Route path="tasks" element={<TasksView />} />
              <Route path="matrix" element={<Navigate to="/tasks?view=matrix" replace />} />
              <Route path="calendar" element={<CalendarView />} />
              <Route path="routines" element={<RoutinesScreen />} />
              <Route path="focus" element={<FocusTimerView />} />
              <Route path="habits" element={<HabitsView />} />
              <Route path="habits/:id" element={<HabitDetailScreen />} />
              <Route path="insights" element={<InsightsScreen />} />
              <Route path="people" element={<PeopleView />} />
              <Route path="people/:id" element={<PersonProfileView />} />
              <Route path="search" element={<SearchView />} />
              <Route path="tags" element={<TagsView />} />
              <Route path="areas" element={<Navigate to="/tags" replace />} />
              <Route path="archive" element={<ArchiveView />} />
              <Route path="trash" element={<TrashView />} />
              <Route path="settings" element={<SettingsView />} />
              <Route path="settings/labs" element={<LabsScreen />} />
              <Route path="settings/templates" element={<TemplatesScreen />} />

              {/* Debug & developer tools */}
              <Route path="debug/migrate" element={<MigrateDebugScreen />} />
              <Route path="debug/seed" element={<SeedDebugScreen />} />

              {/* Catch-all redirect to /today */}
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </FocusTimerProvider>
    </SnackbarProvider>
  );
}
