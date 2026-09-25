/**
 * NoteLink Contract (Phase 2B)
 * Implements EXPANSION_PLAN §4 specs.
 */

export interface NoteLink {
  id?: number;
  sourceId: number;                     // note containing the [[link]]
  targetId: number | null;              // resolved note id, null = unresolved
  targetTitle: string;                  // raw text inside [[ ]] (normalized for matching)
  context: string;                      // ±60 chars around the link, for backlink snippets
  createdAt: number;
}
