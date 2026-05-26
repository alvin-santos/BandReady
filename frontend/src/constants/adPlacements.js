/** Placement keys used by AdSlot and the public advertise proposal form. */
export const AD_SLOT_SPECS = {
  top_banner: { minHeight: 90, maxWidth: 728, label: '728 × 90' },
  sidebar: { minHeight: 250, maxWidth: 300, label: '300 × 250' },
  between_sections: { minHeight: 120, maxWidth: '100%', label: 'Responsive' },
  results_a: { minHeight: 200, maxWidth: '100%', label: 'Results slot' },
  results_b: { minHeight: 200, maxWidth: '100%', label: 'Results slot' },
  dashboard: { minHeight: 140, maxWidth: '100%', label: 'Dashboard' },
  forum_leaderboard: { minHeight: 90, maxWidth: 728, label: 'Forum leaderboard 728 × 90' },
  forum_sidebar: { minHeight: 250, maxWidth: 300, label: 'Forum sidebar 300 × 250' },
  forum_category_inline: { minHeight: 100, maxWidth: '100%', label: 'Forum board — inline' },
  forum_thread_inline: { minHeight: 120, maxWidth: '100%', label: 'Forum thread — inline' },
  exam_rail_left: { minHeight: 250, maxWidth: 300, label: 'Exam left rail 300 × 250' },
  exam_rail_right: { minHeight: 250, maxWidth: 300, label: 'Exam right rail 300 × 250' },
  resources_a: { minHeight: 120, maxWidth: '100%', label: 'Resources — top' },
  resources_b: { minHeight: 120, maxWidth: '100%', label: 'Resources — below list' },
  rankings_a: { minHeight: 120, maxWidth: '100%', label: 'Rankings — above filters' },
  rankings_b: { minHeight: 120, maxWidth: '100%', label: 'Rankings — below table' },
};

export const AD_PLACEMENT_OPTIONS = Object.entries(AD_SLOT_SPECS).map(([value, spec]) => ({
  value,
  label: spec.label,
}));
