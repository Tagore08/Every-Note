import { useState } from 'react';
import { db } from '../../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { linksRepo } from '../../db/repos/linksRepo';

const SAMPLE_TAGS = ['work', 'ideas', 'health', 'reading', 'finance', 'project', 'weekly', 'quotes'];
const SAMPLE_TOPICS = [
  'Reflections on local-first software architecture',
  'Weekly grocery list and meal planning',
  'Design review notes for client dashboard',
  'Books to read in Q4',
  'Sprint retro notes and improvement action items',
  'Quick reminder to update dependencies',
  'Meeting minutes: engineering sync',
  'Database indexing strategies and query performance',
  'UI ideas for the upcoming mobile release',
  'Morning workout routine and stretch habits',
];

export function SeedDebugScreen() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedCount, setSeedCount] = useState<number>(500);
  const [status, setStatus] = useState<string | null>(null);

  const totalNotes = useLiveQuery(() => db.notes.count()) ?? 0;
  const totalLinks = useLiveQuery(() => db.links.count()) ?? 0;

  const handleSeedGraph = async () => {
    try {
      setIsSeeding(true);
      const startTime = performance.now();
      setStatus('Generating 1,000 notes with 2,000 wikilinks...');
      const notesToInsert = [];
      const now = Date.now();

      for (let i = 1; i <= 1000; i++) {
        const target1 = ((i * 7) % 1000) + 1;
        const target2 = ((i * 13) % 1000) + 1;
        const areaId = (i % 7) + 1;

        notesToInsert.push({
          title: `Graph Benchmark #${i}`,
          content: `Benchmark note #${i}.\n\nReferences [[Graph Benchmark #${target1}]] for architecture and [[Graph Benchmark #${target2}|module info]] for implementation details.`,
          tags: [SAMPLE_TAGS[i % SAMPLE_TAGS.length]],
          pinned: false,
          archived: false,
          inbox: false,
          lifeAreaId: areaId,
          trashedAt: null,
          scheduledAt: null,
          reminderAt: null,
          personId: null,
          createdAt: new Date(now - i * 60000),
          updatedAt: new Date(now - i * 30000),
        });
      }

      await db.notes.bulkAdd(notesToInsert);
      setStatus('Re-indexing 2,000 wikilinks across database...');
      const res = await linksRepo.reindexAllLinks();
      const elapsed = Math.round(performance.now() - startTime);

      setStatus(
        `Successfully seeded 1,000 notes + ${res.createdLinks} links in ${elapsed}ms! Open /graph to test rendering.`
      );
    } catch (err: any) {
      setStatus(`Error seeding graph: ${err?.message || String(err)}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearGraph = async () => {
    try {
      setIsSeeding(true);
      setStatus('Removing graph benchmark notes...');
      const testNotes = await db.notes
        .filter((n) => n.title.startsWith('Graph Benchmark #'))
        .toArray();
      const testIds = testNotes.map((n) => n.id!);

      await db.notes.bulkDelete(testIds);
      await linksRepo.reindexAllLinks();
      setStatus(`Removed ${testIds.length} graph benchmark notes and reset links.`);
    } catch (err: any) {
      setStatus(`Error clearing graph notes: ${err?.message || String(err)}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSeed = async () => {
    try {
      setIsSeeding(true);
      setStatus(`Generating ${seedCount} test notes...`);
      const notesToInsert = [];
      const now = Date.now();

      for (let i = 1; i <= seedCount; i++) {
        const topic = SAMPLE_TOPICS[i % SAMPLE_TOPICS.length];
        const tags = [
          SAMPLE_TAGS[i % SAMPLE_TAGS.length],
          SAMPLE_TAGS[(i + 3) % SAMPLE_TAGS.length],
        ];
        const isPinned = i % 25 === 0;
        const isInbox = i % 10 === 0;

        notesToInsert.push({
          title: `Test Note #${i}: ${topic}`,
          content: `This is automated benchmark note #${i}.\n\nParagraph with test text to verify virtualized list rendering, search indexing, and 60fps scrolling under load. Tags: ${tags.join(', ')}`,
          tags,
          pinned: isPinned,
          archived: false,
          inbox: isInbox,
          trashedAt: null,
          scheduledAt: null,
          reminderAt: null,
          personId: null,
          createdAt: new Date(now - i * 60000 * 15),
          updatedAt: new Date(now - i * 30000),
        });
      }

      await db.notes.bulkAdd(notesToInsert);
      setStatus(`Successfully added ${seedCount} benchmark notes! Total notes: ${totalNotes + seedCount}.`);
    } catch (err: any) {
      setStatus(`Error seeding notes: ${err?.message || String(err)}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearSeeded = async () => {
    try {
      setIsSeeding(true);
      setStatus('Removing test benchmark notes...');
      const testIds = (
        await db.notes.filter((n) => n.title.startsWith('Test Note #')).toArray()
      ).map((n) => n.id!);

      await db.notes.bulkDelete(testIds);
      setStatus(`Removed ${testIds.length} benchmark test notes.`);
    } catch (err: any) {
      setStatus(`Error clearing notes: ${err?.message || String(err)}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Performance Tool
          </span>
          <h1 className="text-2xl font-semibold text-ink">Benchmark Seed Data</h1>
        </div>
        <p className="text-sm text-ink-muted mt-1">
          Seed 500+ records to test @tanstack/react-virtual list performance and 60fps scrolling.
        </p>
      </div>

      <div className="p-6 rounded-card bg-surface border border-border shadow-card space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">Current Total Notes</div>
            <div className="text-3xl font-bold text-accent mt-1">{totalNotes}</div>
          </div>
          <div className="text-right">
            <label className="text-xs text-ink-muted block mb-1">Batch Size</label>
            <select
              value={seedCount}
              onChange={(e) => setSeedCount(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-ink text-sm"
            >
              <option value={100}>100 notes</option>
              <option value={500}>500 notes (Recommended)</option>
              <option value={1000}>1,000 notes</option>
            </select>
          </div>
        </div>

        {status && (
          <div className="p-3 rounded-lg bg-surface-2 border border-border text-xs text-ink">
            {status}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex-1 py-2.5 px-4 rounded-pill bg-accent text-accent-ink text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-card cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            {isSeeding ? 'Generating...' : `Seed ${seedCount} Test Notes`}
          </button>
          <button
            type="button"
            onClick={handleClearSeeded}
            disabled={isSeeding}
            className="py-2.5 px-4 rounded-pill bg-surface-2 hover:bg-surface text-danger text-sm font-semibold border border-border transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            Clear Test Notes
          </button>
        </div>
      </div>

      {/* Phase 2B Performance Gate Card */}
      <div className="p-6 rounded-card bg-surface border border-border shadow-card space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">Graph Benchmark Dataset</div>
            <p className="text-xs text-ink-muted mt-0.5">
              1,000 notes + 2,000 interconnected wikilinks to verify d3-force & canvas render speed.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-muted">Total Links</div>
            <div className="text-2xl font-bold text-accent mt-0.5">{totalLinks}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleSeedGraph}
            disabled={isSeeding}
            className="flex-1 py-2.5 px-4 rounded-pill bg-accent text-accent-ink text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-card cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            {isSeeding ? 'Benchmarking...' : 'Seed 1,000 Notes + 2,000 Links'}
          </button>
          <button
            type="button"
            onClick={handleClearGraph}
            disabled={isSeeding}
            className="py-2.5 px-4 rounded-pill bg-surface-2 hover:bg-surface text-danger text-sm font-semibold border border-border transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            Clear Graph Benchmark
          </button>
        </div>
      </div>
    </div>
  );
}
