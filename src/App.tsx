import { Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { InboxView } from './components/views/InboxView';
import { NotesView } from './components/views/NotesView';
import { NoteEditorView } from './components/views/NoteEditorView';
import { SearchView } from './components/views/SearchView';
import { TagsView } from './components/views/TagsView';
import { StageZeroPlaceholder } from './components/views/StageZeroPlaceholder';

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/inbox" replace />} />
        <Route path="inbox" element={<InboxView />} />
        <Route path="notes" element={<NotesView />} />
        <Route path="notes/:id" element={<NoteEditorView />} />
        <Route path="search" element={<SearchView />} />
        <Route path="tags" element={<TagsView />} />
        <Route
          path="settings"
          element={
            <StageZeroPlaceholder
              title="Settings"
              description="Manage appearance, database storage, and offline preferences."
            />
          }
        />
        <Route path="*" element={<Navigate to="/inbox" replace />} />
      </Route>
    </Routes>
  );
}
