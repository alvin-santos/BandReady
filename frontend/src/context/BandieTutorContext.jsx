import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client.js';

const LS_DISMISS = 'bandie-dismissed';
const LS_INTRO = 'bandie-intro-seen';

export const tutorTips = {
  speaking: [
    'Speak continuously. Avoid long pauses.',
    'Fluency matters more than perfect grammar.',
    'Use examples to support your answer.',
    'Try to speak for the full time.',
    'Avoid one-word answers.',
    "Use linking words like 'because' and 'also'.",
    'Add personal experiences.',
    "Don't worry about your accent.",
    'Explain your ideas clearly.',
    'Keep talking even if you make mistakes.',
  ],
  writing: [
    'Answer the question directly first.',
    'Use paragraphs to organize ideas.',
    'Give at least one example.',
    "Don't repeat the same words.",
    'Use simple sentences if unsure.',
    'Check spelling before submitting.',
    'Write more than the minimum word count.',
    'Support opinions with reasons.',
    'Stay on topic.',
    'Use linking words between sentences.',
  ],
  reading: [
    'Read questions before the passage.',
    'Scan for keywords.',
    "Don't read everything slowly.",
    'Watch for synonyms.',
    'Skip hard questions and return later.',
    'Answers follow order in passage.',
    'Focus on names and numbers.',
    'Use elimination method.',
    "Don't overthink.",
    'Look for paraphrased meaning.',
  ],
  listening: [
    'Focus on keywords.',
    'Answers follow the audio order.',
    "Don't panic if you miss one.",
    'Watch spelling carefully.',
    'Listen for paraphrasing.',
    'Keep eyes on next question.',
    'Write while listening.',
    'Stay focused until the end.',
    'Check grammar of answers.',
    'Plural and singular matter.',
  ],
};

export const INTRO_MESSAGE = "Hi! I'm Bandie. I'll help you improve your band score.";

const DEFAULT_SECTION = 'reading';

export function normalizeSection(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('speak')) {
    return 'speaking';
  }
  if (s.includes('writ')) {
    return 'writing';
  }
  if (s.includes('read')) {
    return 'reading';
  }
  if (s.includes('listen')) {
    return 'listening';
  }
  return DEFAULT_SECTION;
}

const BandieContext = createContext(null);

export function BandieTutorProvider({ children }) {
  const location = useLocation();
  const [siteBandieEnabled, setSiteBandieEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/bandie-tutor-settings')
      .then((res) => {
        if (!cancelled) {
          setSiteBandieEnabled(!!res.data.bandie_tutor_enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSiteBandieEnabled(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hideChrome = location.pathname.startsWith('/admin') || !siteBandieEnabled;

  const [dismissed, setDismissed] = useState(() => localStorage.getItem(LS_DISMISS) === '1');
  const [section, setSectionState] = useState(DEFAULT_SECTION);
  const [bubbleOpen, setBubbleOpen] = useState(() => localStorage.getItem(LS_DISMISS) !== '1');
  const [message, setMessage] = useState(INTRO_MESSAGE);
  const [tipIndex, setTipIndex] = useState(0);
  const [rotationOn, setRotationOn] = useState(false);
  const [tempHidden, setTempHidden] = useState(false);

  const rotateTimerRef = useRef(null);
  const introTimerRef = useRef(null);
  const sectionRef = useRef(section);
  const messageRef = useRef(message);
  const bubbleOpenBeforeTempHideRef = useRef(true);

  useEffect(() => {
    sectionRef.current = section;
  }, [section]);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const stopBandieTips = useCallback(() => {
    if (rotateTimerRef.current) {
      clearInterval(rotateTimerRef.current);
      rotateTimerRef.current = null;
    }
    setRotationOn(false);
  }, []);

  const startBandieTips = useCallback(() => {
    stopBandieTips();
    rotateTimerRef.current = window.setInterval(() => {
      const sec = sectionRef.current;
      const list = tutorTips[sec] || tutorTips[DEFAULT_SECTION];
      if (!list.length) {
        return;
      }
      setTipIndex((i) => {
        const next = (i + 1) % list.length;
        setMessage(list[next]);
        return next;
      });
    }, 30000);
    setRotationOn(true);
  }, [stopBandieTips]);

  const clearIntroTimer = useCallback(() => {
    if (introTimerRef.current) {
      clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
  }, []);

  const applySectionTips = useCallback(
    (sec, startRotate) => {
      const list = tutorTips[sec] || tutorTips[DEFAULT_SECTION];
      setTipIndex(0);
      if (list.length) {
        setMessage(list[0]);
      }
      stopBandieTips();
      if (startRotate && list.length) {
        startBandieTips();
      }
    },
    [stopBandieTips, startBandieTips]
  );

  useEffect(() => {
    if (hideChrome || dismissed || tempHidden || !bubbleOpen) {
      clearIntroTimer();
      stopBandieTips();
      return;
    }

    const introSeen = localStorage.getItem(LS_INTRO) === '1';

    if (!introSeen) {
      setMessage(INTRO_MESSAGE);
      stopBandieTips();
      clearIntroTimer();
      introTimerRef.current = window.setTimeout(() => {
        localStorage.setItem(LS_INTRO, '1');
        applySectionTips(sectionRef.current, true);
      }, 4000);
      return () => {
        clearIntroTimer();
      };
    }

    applySectionTips(section, true);
    return () => {
      stopBandieTips();
    };
  }, [hideChrome, dismissed, tempHidden, bubbleOpen, section, clearIntroTimer, stopBandieTips, applySectionTips]);

  const setTutorSection = useCallback((raw) => {
    setSectionState(normalizeSection(raw));
  }, []);

  const tempHideBandie = useCallback(() => {
    bubbleOpenBeforeTempHideRef.current = bubbleOpen;
    setTempHidden(true);
    setBubbleOpen(false);
    clearIntroTimer();
    stopBandieTips();
  }, [bubbleOpen, clearIntroTimer, stopBandieTips]);

  const restoreBandie = useCallback(() => {
    setTempHidden(false);
    setBubbleOpen(bubbleOpenBeforeTempHideRef.current);
  }, []);

  const showBandie = useCallback(
    (custom) => {
      setTempHidden(false);
      setDismissed(false);
      localStorage.removeItem(LS_DISMISS);
      setBubbleOpen(true);
      clearIntroTimer();
      if (typeof custom === 'string' && custom.trim()) {
        localStorage.setItem(LS_INTRO, '1');
        setMessage(custom.trim());
        stopBandieTips();
        startBandieTips();
      }
    },
    [clearIntroTimer, stopBandieTips, startBandieTips]
  );

  const hideBandie = useCallback(() => {
    clearIntroTimer();
    stopBandieTips();
    setTempHidden(false);
    setDismissed(true);
    setBubbleOpen(false);
    localStorage.setItem(LS_DISMISS, '1');
  }, [clearIntroTimer, stopBandieTips]);

  const minimizeBubble = useCallback(() => {
    setBubbleOpen(false);
    clearIntroTimer();
    stopBandieTips();
    if (localStorage.getItem(LS_INTRO) !== '1') {
      localStorage.setItem(LS_INTRO, '1');
    }
  }, [clearIntroTimer, stopBandieTips]);

  const toggleBubble = useCallback(() => {
    setBubbleOpen((open) => {
      if (open) {
        clearIntroTimer();
        stopBandieTips();
        return false;
      }
      return true;
    });
  }, [clearIntroTimer, stopBandieTips]);

  const nextTip = useCallback(() => {
    if (messageRef.current === INTRO_MESSAGE) {
      clearIntroTimer();
      localStorage.setItem(LS_INTRO, '1');
      const list = tutorTips[sectionRef.current] || tutorTips[DEFAULT_SECTION];
      if (!list.length) {
        return;
      }
      setTipIndex(0);
      setMessage(list[0]);
      stopBandieTips();
      startBandieTips();

      return;
    }
    const list = tutorTips[sectionRef.current] || tutorTips[DEFAULT_SECTION];
    if (!list.length) {
      return;
    }
    setTipIndex((i) => {
      const next = (i + 1) % list.length;
      setMessage(list[next]);
      return next;
    });
  }, [clearIntroTimer, stopBandieTips, startBandieTips]);

  const value = useMemo(
    () => ({
      section,
      setTutorSection,
      showBandie,
      hideBandie,
      minimizeBubble,
      toggleBubble,
      startBandieTips,
      stopBandieTips,
      nextTip,
      tempHidden,
      tempHideBandie,
      restoreBandie,
      dismissed,
      bubbleOpen,
      message,
      rotationOn,
      hideChrome,
    }),
    [
      section,
      setTutorSection,
      showBandie,
      hideBandie,
      minimizeBubble,
      toggleBubble,
      startBandieTips,
      stopBandieTips,
      nextTip,
      tempHidden,
      tempHideBandie,
      restoreBandie,
      dismissed,
      bubbleOpen,
      message,
      rotationOn,
      hideChrome,
    ]
  );

  return <BandieContext.Provider value={value}>{children}</BandieContext.Provider>;
}

export function useBandieTutor() {
  const ctx = useContext(BandieContext);
  if (!ctx) {
    throw new Error('useBandieTutor must be used within BandieTutorProvider');
  }
  return ctx;
}

export function useBandieTutorOptional() {
  return useContext(BandieContext);
}

export { DEFAULT_SECTION };
