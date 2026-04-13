/**
 * CELPIP General official-style task structure (public rubric).
 * Kept in sync with backend App\Support\CelpipOfficialTaskCatalog::TASKS_BY_SECTION.
 */

export const CELPIP_SECTION_TASKS = {
  Listening: [
    { id: 1, label: 'Problem solving' },
    { id: 2, label: 'A daily life conversation' },
    { id: 3, label: 'Information' },
    { id: 4, label: 'News item' },
    { id: 5, label: 'Discussion' },
    { id: 6, label: 'Viewpoints' },
  ],
  Reading: [
    { id: 1, label: 'Correspondence' },
    { id: 2, label: 'Apply a Diagram' },
    { id: 3, label: 'Information' },
    { id: 4, label: 'Viewpoints' },
  ],
  Writing: [
    { id: 1, label: 'Writing an Email' },
    { id: 2, label: 'Survey Questions' },
  ],
  Speaking: [
    { id: 1, label: 'Giving Advice' },
    { id: 2, label: 'Talking about personal experience' },
    { id: 3, label: 'Describing a Scene' },
    { id: 4, label: 'Making predictions' },
    { id: 5, label: 'Comparing and Persuading' },
    { id: 6, label: 'Dealing with a difficult situation' },
    { id: 7, label: 'Expressing opinions' },
    { id: 8, label: 'Describing an unusual situation' },
  ],
};

/** Accent colors roughly matching official marketing (practice UI only). */
export const CELPIP_SECTION_CARD_THEME = {
  Listening: { border: '#16a34a', icon: 'bi-ear', softBg: 'rgba(22, 163, 74, 0.08)' },
  Reading: { border: '#e11d48', icon: 'bi-book', softBg: 'rgba(225, 29, 72, 0.08)' },
  Writing: { border: '#ea580c', icon: 'bi-pencil-square', softBg: 'rgba(234, 88, 12, 0.08)' },
  Speaking: { border: '#7c3aed', icon: 'bi-mic', softBg: 'rgba(124, 58, 237, 0.1)' },
};

export function emptySectionTaskPick() {
  return {
    Listening: [],
    Reading: [],
    Writing: [],
    Speaking: [],
  };
}
