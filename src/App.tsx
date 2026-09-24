import { Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { StageZeroPlaceholder } from './components/views/StageZeroPlaceholder';

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/inbox" replace />} />
        <Route
          path="inbox"
          element={
            <StageZeroPlaceholder
              title="Inbox"
              description="Capture quick thoughts and incoming items before organizing them."
            />
          }
        />
        <Route
          path="notes"
          element={
            <StageZeroPlaceholder
              title="Notes"
              description="Browse, filter, and organize all your personal notes."
            />
          }
        />
        <Route
          path="search"
          element={
            <StageZeroPlaceholder
              title="Search"
              description="Fast IndexedDB search across titles, contents, and tags."
            />
          }
        />
        <Route
          path="tags"
          element={
            <StageZeroPlaceholder
              title="Tags"
              description="Explore notes organized by multiEntry indexed tags."
            />
          }
        />
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
