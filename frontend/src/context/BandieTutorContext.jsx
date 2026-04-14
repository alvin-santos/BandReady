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

/** Longer tips with brief “why / exam context” — toggled site-wide via admin. */
export const tutorTipsDetailed = {
  speaking: [
    'Fluency beats perfection: examiners notice long silences more than small grammar slips. Keep your voice moving with simple connectors (“and then…”, “because…”) while you think.',
    'Use one concrete example per main idea—a short story from work, school, or daily life makes your answer easier to follow and sounds more natural than abstract lists.',
    'Aim to use most of the prep/speaking time. If you finish early, add a consequence (“So that meant…”) or a quick contrast (“I used to… but now…”) instead of stopping cold.',
    'One-word answers sound unfinished. Turn “Yes” into “Yes, mainly because…” or restate the question in one clause before you give your view.',
    'Linking words signal logic: “although”, “even so”, “on the other hand”, and “that’s why” help the listener track your argument without you needing perfect vocabulary.',
    'Accent is fine if you’re clear. Slow down slightly on key nouns and stress the words that carry your opinion—listeners grasp meaning from emphasis as much as grammar.',
    'If you lose a word, paraphrase (“the kind of place where…”) instead of freezing. Recovery shows the same communication skill exams reward.',
    'Answer the prompt first, then elaborate. Two short clear sentences beat one long sentence that never quite commits to a position.',
    'Compare or rank ideas when asked (“both matter, but X is more important because…”). That structure matches how many speaking rubrics score “development”.',
    'Mistakes while still developing an idea are better than perfect silence. Self-correct once if needed (“…or rather…”), then continue forward.',
  ],
  writing: [
    'Start with a direct answer to the task (your position or summary line), then support it. Examiners scan for relevance before they reward detail.',
    'One idea per paragraph with a clear topic sentence keeps your essay readable under time pressure and matches how markers award “coherence”.',
    'Concrete beats vague: swap “many problems” for “traffic delays and higher rent” when you can—specific nouns make arguments feel grounded without needing rare words.',
    'Vary sentence openings (not every sentence with “The”). Simple patterns like “However,” “For example,” and “This suggests” add rhythm and cohesion.',
    'If you’re unsure of a complex structure, choose two short correct sentences instead of one long risky one. Accuracy still matters alongside range.',
    'Save two minutes for a quick spell-check of task words (names, question terms) and obvious typos—first impressions include clean key terms.',
    'Word count: aim clearly above the minimum so you have room for development; thin essays rarely hit top bands even when grammar is clean.',
    'When you give an opinion, add “because” with a reason, then optionally “for example” with a mini-example—that’s a full band-building move in one paragraph.',
    'Stay on the question’s scope. If it asks about “your local area”, don’t drift into global policy unless you tie it back (“In my city that shows up as…”).',
    'Use discourse markers between paragraphs (“Another factor is…”, “In contrast…”) so the reader feels a planned structure, not a list of random points.',
  ],
  reading: [
    'Skim the questions first so you know what to hunt for—names, dates, opinions, or “according to the text” stems tell you what to anchor on while you read.',
    'Answers usually follow passage order on many tests: if you’re stuck, don’t burn minutes on one item—flag mentally and move on, then return with fresher eyes.',
    'Paraphrase is normal: the correct option may use different words than the passage. Match meaning and attitude, not identical wording.',
    'Elimination works when two options sound plausible: find the one line in the passage that confirms one and contradicts the other, even subtly.',
    'Numbers and proper nouns are easy anchors—underline mentally when you see them; questions often target exactly those details.',
    '“Main purpose” and “writer’s attitude” items need the whole paragraph context, not the first sentence only—read the shift sentences too.',
    'Don’t read every word at the same speed: slow down for the paragraph that matches the question stem, skim transitions elsewhere.',
    'If an option introduces an idea never mentioned, it’s usually wrong—good distractors stay inside the passage’s topic universe.',
    'Time box: if you’ve re-read the same lines twice without progress, pick your best elimination guess and move on—unfinished easy items cost more than one hard guess.',
    'Inference items still need evidence: choose the option best supported by a combination of sentences, not the one that sounds smartest in general knowledge.',
  ],
  listening: [
    'The clip and the question are one unit: the right answer is something you could defend by pointing to what was said—not general life advice.',
    'Listen for signposts (“the problem is…”, “what we decided…”, “the reason I called…”). They often introduce the exact idea the MCQ tests.',
    'Audio often moves in order while questions follow the clip—if you miss an answer, jump to the next question’s window instead of replaying the whole thing in your head forever.',
    'Spelling still counts on written responses: note plural endings and small words you mis-hear (“than” vs “then”) when you transfer answers.',
    'Speakers paraphrase: the stem may say “postpone” while audio says “push it to next week”—train your ear for synonyms under exam stress.',
    'Keep your eyes on the next stem while the clip plays for the prior item if the interface allows it—you’ll know what detail to listen for on the second pass mentally.',
    'Jot keywords during long clips (names, times, negatives like “didn’t”) so you don’t rely on memory when the options appear.',
    'If two options both sound familiar, ask which one matches the speaker’s final stance—last-minute corrections happen a lot in dialogues.',
    'Don’t panic on one missed detail: later items may be easier; missing one beat losing the rhythm for the whole section.',
    'Check subject–verb and tense when you write the answer: audio might be past tense while an option tempts you with present—match the speakers’ timeframe.',
    'Map answers to the order of information in the clip: if the stem asks about a later development, wait for that part of the audio before you lock in a choice—first mentions can be red herrings.',
  ],
};

export const INTRO_MESSAGE =
  "Hi! I'm Bandie. I'll share quick tips while you practice—things that help with timing, staying on task, and what markers listen for.";

const DEFAULT_SECTION = 'reading';

function resolveTips(section, useDetailed, banks) {
  const sec = section in tutorTips ? section : DEFAULT_SECTION;
  const bank = useDetailed ? banks.detailed : banks.compact;
  return bank[sec] || bank[DEFAULT_SECTION];
}

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

function mergeTipBanks(fromApi, fallback) {
  if (!fromApi || typeof fromApi !== 'object') {
    return { ...fallback };
  }
  const out = { ...fallback };
  for (const k of ['speaking', 'reading', 'writing', 'listening']) {
    if (Array.isArray(fromApi[k]) && fromApi[k].length) {
      const lines = fromApi[k].map((s) => String(s).trim()).filter(Boolean);
      if (lines.length) {
        out[k] = lines;
      }
    }
  }
  return out;
}

export function BandieTutorProvider({ children }) {
  const location = useLocation();
  const [siteBandieEnabled, setSiteBandieEnabled] = useState(true);
  const bandieTipsDetailedRef = useRef(true);
  const tipsBanksRef = useRef({
    compact: tutorTips,
    detailed: tutorTipsDetailed,
  });
  const tipControlRef = useRef({ stop: () => {}, start: () => {} });

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
      const list = resolveTips(sec, bandieTipsDetailedRef.current, tipsBanksRef.current);
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
      const list = resolveTips(sec, bandieTipsDetailedRef.current, tipsBanksRef.current);
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
      const list = resolveTips(sectionRef.current, bandieTipsDetailedRef.current, tipsBanksRef.current);
      if (!list.length) {
        return;
      }
      setTipIndex(0);
      setMessage(list[0]);
      stopBandieTips();
      startBandieTips();

      return;
    }
    const list = resolveTips(sectionRef.current, bandieTipsDetailedRef.current, tipsBanksRef.current);
    if (!list.length) {
      return;
    }
    setTipIndex((i) => {
      const next = (i + 1) % list.length;
      setMessage(list[next]);
      return next;
    });
  }, [clearIntroTimer, stopBandieTips, startBandieTips]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/bandie-tutor-settings')
      .then((res) => {
        if (cancelled) {
          return;
        }
        setSiteBandieEnabled(!!res.data.bandie_tutor_enabled);
        bandieTipsDetailedRef.current = res.data.bandie_tips_detailed !== false;
        tipsBanksRef.current = {
          compact: mergeTipBanks(res.data.bandie_tutor_tips_compact, tutorTips),
          detailed: mergeTipBanks(res.data.bandie_tutor_tips_detailed, tutorTipsDetailed),
        };
        if (localStorage.getItem(LS_INTRO) === '1') {
          const sec = sectionRef.current;
          const list = resolveTips(sec, bandieTipsDetailedRef.current, tipsBanksRef.current);
          if (list.length) {
            setTipIndex(0);
            setMessage(list[0]);
            tipControlRef.current.stop();
            tipControlRef.current.start();
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSiteBandieEnabled(true);
          bandieTipsDetailedRef.current = true;
          tipsBanksRef.current = {
            compact: tutorTips,
            detailed: tutorTipsDetailed,
          };
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  tipControlRef.current = { stop: stopBandieTips, start: startBandieTips };

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
