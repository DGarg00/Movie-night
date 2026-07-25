import { useEffect, useState } from 'react';

const HOLD_MS = 2600;
const FADE_MS = 400;

export default function BanPopups({ names }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (names && names.length) setQueue(names);
  }, [names]);

  useEffect(() => {
    if (current || !queue.length) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
    setVisible(false);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(raf);
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    const hideTimer = setTimeout(() => setVisible(false), HOLD_MS);
    const nextTimer = setTimeout(() => setCurrent(null), HOLD_MS + FADE_MS);
    return () => { clearTimeout(hideTimer); clearTimeout(nextTimer); };
  }, [current]);

  if (!current) return null;

  return (
    <div className="ban-popup-stack">
      <div className={`ban-popup ${visible ? 'show' : ''}`}>
        {current} was banned for violating restrictions.
      </div>
    </div>
  );
}