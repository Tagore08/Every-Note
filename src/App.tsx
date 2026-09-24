import { Routes, Route, Navigate } from 'react-router-dom';
import { SnackbarProvider } from './context/SnackbarContext';
import { Shell } from './components/layout/Shell';
import { UpcomingView } from './components/views/UpcomingView';
import { InboxView } from './components/views/InboxView';
import { NotesView } from './components/views/NotesView';
import { TasksView } from './components/views/TasksView';
import { CalendarView } from './components/views/CalendarView';
import { HabitsView } from './components/views/HabitsView';
import { PeopleView } from './components/views/PeopleView';
import { PersonProfileView } from './components/views/PersonProfileView';
import { NoteEditorView } from './components/views/NoteEditorView';
import { SearchView } from './components/views/SearchView';
import { TagsView } from './components/views/TagsView';
import { ArchiveView } from './components/views/ArchiveView';
import { TrashView } from './components/views/TrashView';
import { SettingsView } from './components/views/SettingsView';

export function App() {
  return (
    <SnackbarProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/upcoming" replace />} />
          <Route path="upcoming" element={<UpcomingView />} />
          <Route path="inbox" element={<InboxView />} />
          <Route path="notes" element={<NotesView />} />
          <Route path="notes/:id" element={<NoteEditorView />} />
          <Route path="tasks" element={<TasksView />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="habits" element={<HabitsView />} />
          <Route path="people" element={<PeopleView />} />
          <Route path="people/:id" element={<PersonProfileView />} />
          <Route path="search" element={<SearchView />} />

          <Route path="tags" element={<TagsView />} />
          <Route path="archive" element={<ArchiveView />} />
          <Route path="trash" element={<TrashView />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/upcoming" replace />} />
        </Route>
      </Routes>
    </SnackbarProvider>
  );
}

