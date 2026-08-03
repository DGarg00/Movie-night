import { useEffect, useState } from 'react';

const HOLD_MS = 5000;
const GAP_MS = 400;

export default function BanPopups({ names }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [popKey, setPopKey] = useState(0);

  useEffect(() => {
    if (names && names.length) setQueue(names);
  }, [names]);

  useEffect(() => {
    if (current !== null || !queue.length) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
    setPopKey(k => k + 1);
  }, [queue, current]);

  useEffect(() => {
    if (current === null) return;
    const t = setTimeout(() => setCurrent(null), HOLD_MS + GAP_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (current === null) return null;

  return (
    <div className="ban-popup-stack">
      <div className="ban-popup ban-popup-anim" key={popKey}>
        {current} was banned for violating restrictions.
      </div>
    </div>
  );
}
