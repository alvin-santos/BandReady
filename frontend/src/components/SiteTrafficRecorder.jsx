import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { recordSiteVisit } from '../utils/siteTraffic.js';

/**
 * Sends one lightweight visit row per navigation (deduped briefly for React Strict Mode).
 */
export default function SiteTrafficRecorder() {
  const location = useLocation();
  const lastRef = useRef({ key: '', at: 0 });

  useEffect(() => {
    const path = `${location.pathname}${location.search}`.slice(0, 512);
    const now = Date.now();
    if (lastRef.current.key === path && now - lastRef.current.at < 1500) {
      return;
    }
    lastRef.current = { key: path, at: now };
    void recordSiteVisit(path);
  }, [location.pathname, location.search]);

  return null;
}
