const DEFAULT_DESCRIPTION =
  'Free online IELTS exam and CELPIP test practice—timed sections, scoring, forum & rankings. Guests: Reading & Writing; sign in for Listening & Speaking. BandReady Pro adds AI feedback where enabled.';

/** @type {Record<string, { title: string; description: string }>} */
const EXACT = {
  '/': {
    title: 'BandReady — Free online IELTS exam & CELPIP test practice',
    description: DEFAULT_DESCRIPTION,
  },
  '/how-it-works': {
    title: 'How BandReady works — AI-powered CELPIP & IELTS preparation',
    description:
      'How BandReady helps you prepare for CELPIP and IELTS: enter exam date, generate a study plan, practice tasks, get feedback, and improve with progress tracking.',
  },
  '/features': {
    title: 'Features — BandReady AI-powered CELPIP & IELTS prep',
    description:
      'BandReady features: AI study plan, speaking practice, writing evaluation, band/level guidance, daily tasks, and progress tracking for CELPIP and IELTS preparation.',
  },
  '/blog': {
    title: 'Blog — CELPIP & IELTS preparation guides',
    description:
      'Read BandReady’s blog for CELPIP and IELTS preparation: study plans, speaking structure, writing improvement, exam strategy, and practice routines.',
  },
  '/guides': {
    title: 'Study guides — CELPIP & IELTS preparation',
    description:
      'In-depth BandReady study guides: choosing CELPIP vs IELTS General, timed practice habits, weekly prep rhythm, and using AI feedback responsibly.',
  },
  '/content-standards': {
    title: 'Content standards — BandReady editorial policy',
    description:
      'How BandReady handles editorial quality, practice materials, AI-assisted features, forum content, and advertising—independent exam preparation.',
  },
  '/why-bandready': {
    title: 'Why BandReady?',
    description:
      'How BandReady’s free online IELTS exam and CELPIP test practice works: timed runs, scoring, what is included for free, and how results relate to official tests.',
  },
  '/practice-disclaimer': {
    title: 'Practice disclaimer',
    description: 'Important information about BandReady practice mode, scoring, and how results relate to official tests.',
  },
  '/contact': {
    title: 'Contact',
    description: 'Contact BandReady for support, feedback, or partnership questions.',
  },
  '/advertise': {
    title: 'Advertise on BandReady',
    description:
      'Submit a display ad or sponsorship proposal for BandReady practice pages, exam runs, rankings, forum, and other placements.',
  },
  '/about': {
    title: 'About BandReady',
    description:
      'Learn what BandReady is: independent IELTS and CELPIP-style online practice, dashboards, forum, and how we relate to official tests.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy',
    description:
      'BandReady Privacy Policy: what we collect, cookies, Google AdSense, third parties (Stripe, Google sign-in, AI), and your choices.',
  },
  '/terms': {
    title: 'Terms of Service',
    description:
      'BandReady Terms of Service: acceptable use, AI feature guidance, subscriptions, disclaimers, and how to contact us.',
  },
  '/forum': {
    title: 'Community forum',
    description:
      'Discuss free online IELTS exam prep, CELPIP test tips, and study strategies with other learners on the BandReady forum.',
  },
  '/login': {
    title: 'Sign in',
    description: 'Sign in to BandReady to save attempts, unlock Pro features, and join the community.',
  },
  '/register': {
    title: 'Create account',
    description:
      'Create a free BandReady account for online IELTS and CELPIP practice: save attempts, unlock Listening & Speaking, analytics, and Pro options.',
  },
  '/auth/google': {
    title: 'Google sign-in',
    description: 'Completing Google sign-in for your BandReady account.',
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
    description:
      'Free IELTS and CELPIP-style prep resources on BandReady: guides, downloads, and links to help your online exam practice.',
  },
  '/exam/start': {
    title: 'Free online IELTS exam & CELPIP test — Start',
    description:
      'Start a free online IELTS exam or CELPIP test practice run: pick your program, full mock sections, timers, and scoring. Guests can use Reading & Writing; sign in for Listening & Speaking.',
  },
  '/practice/mistakes': {
    title: 'Mistakes hub',
    description: 'Review questions you missed and strengthen weak areas with BandReady.',
  },
  '/ai-interview-practice': {
    title: 'AI Interview Practice (Bandie)',
    description:
      'Practice job and English speaking interviews with BandReady’s Bandie AI: voice or text, timed sessions, transcript, and feedback.',
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
  if (path.startsWith('/blog/')) {
    return {
      title: 'Blog article — BandReady',
      description: 'Read this BandReady article about CELPIP and IELTS preparation strategies and study routines.',
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
      title: 'Online IELTS & CELPIP practice exam',
      description:
        'Your timed free online IELTS or CELPIP-style practice session on BandReady—listening, reading, writing, or speaking with on-screen controls.',
    };
  }
  if (path.startsWith('/results/')) {
    return {
      title: 'Practice test results',
      description:
        'Review scores and feedback from your free online IELTS exam or CELPIP test practice attempt on BandReady.',
    };
  }

  return {
    title: 'BandReady — Free online IELTS & CELPIP practice',
    description: DEFAULT_DESCRIPTION,
  };
}
