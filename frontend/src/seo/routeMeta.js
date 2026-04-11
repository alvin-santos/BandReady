const DEFAULT_DESCRIPTION =
  'BandReady offers timed IELTS and CELPIP-style practice: listening, reading, writing, and speaking with automatic scoring, AI feedback options, community forum, rankings, and downloadable resources.';

/** @type {Record<string, { title: string; description: string }>} */
const EXACT = {
  '/': {
    title: 'BandReady — IELTS & CELPIP exam practice',
    description: DEFAULT_DESCRIPTION,
  },
  '/why-bandready': {
    title: 'Why BandReady?',
    description:
      'What BandReady is for, how practice and scoring work, and how we help you prepare for IELTS and CELPIP-style exams.',
  },
  '/practice-disclaimer': {
    title: 'Practice disclaimer',
    description: 'Important information about BandReady practice mode, scoring, and how results relate to official tests.',
  },
  '/contact': {
    title: 'Contact',
    description: 'Contact BandReady for support, feedback, or partnership questions.',
  },
  '/forum': {
    title: 'Community forum',
    description: 'Discuss IELTS, CELPIP, and English exam prep with other learners on the BandReady forum.',
  },
  '/login': {
    title: 'Sign in',
    description: 'Sign in to BandReady to save attempts, unlock Pro features, and join the community.',
  },
  '/register': {
    title: 'Create account',
    description: 'Create a free BandReady account to track practice, scores, and progress.',
  },
  '/verify-email': {
    title: 'Verify email',
    description: 'Confirm your email address to finish setting up your BandReady account.',
  },
  '/subscription': {
    title: 'BandReady Pro',
    description: 'BandReady Pro subscription: AI writing and speaking feedback, usage limits, and billing.',
  },
  '/rankings': {
    title: 'Rankings',
    description: 'See how you compare on BandReady practice metrics and leaderboard rankings.',
  },
  '/resources': {
    title: 'Resources',
    description: 'Downloadable guides and resources for IELTS and CELPIP-style exam preparation.',
  },
  '/exam/start': {
    title: 'Start practice',
    description: 'Choose a test and start a timed BandReady practice attempt.',
  },
  '/practice/mistakes': {
    title: 'Mistakes hub',
    description: 'Review questions you missed and strengthen weak areas with BandReady.',
  },
  '/dashboard': {
    title: 'Dashboard',
    description: 'Your BandReady dashboard: active attempts, history, and quick links to practice.',
  },
  '/analytics': {
    title: 'Analytics',
    description: 'Your BandReady practice analytics and performance trends.',
  },
  '/profile': {
    title: 'Profile',
    description: 'Manage your BandReady profile and account settings.',
  },
};

/**
 * @returns {{ title: string; description: string; noIndex?: boolean }}
 */
export function getRouteMeta(pathname) {
  const path = pathname.replace(/\/$/, '') || '/';

  if (path.startsWith('/admin')) {
    return {
      title: 'Admin',
      description: 'BandReady administration — content, ads, and settings.',
      noIndex: true,
    };
  }

  const exact = EXACT[path];
  if (exact) {
    return exact;
  }

  if (path.startsWith('/forum/thread/')) {
    return {
      title: 'Forum thread',
      description: 'Read and reply to this discussion on the BandReady forum.',
    };
  }
  if (path.startsWith('/forum/category/')) {
    return {
      title: 'Forum category',
      description: 'Threads in this forum category on BandReady.',
    };
  }
  if (path.startsWith('/exam/run/')) {
    return {
      title: 'Practice exam',
      description: 'Timed BandReady practice attempt — listening, reading, writing, or speaking.',
    };
  }
  if (path.startsWith('/results/')) {
    return {
      title: 'Results',
      description: 'Review your BandReady practice attempt results and feedback.',
    };
  }

  return {
    title: 'BandReady',
    description: DEFAULT_DESCRIPTION,
  };
}
