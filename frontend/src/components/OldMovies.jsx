import { useEffect, useState } from 'react';
import { api } from '../api';
import MovieTicket from './MovieTicket';

export default function OldMovies() {
  const [screenings, setScreenings] = useState(null);
  const [loadError, setLoadError] = useState('');

  function load() {
    setLoadError('');
    api.getScreenings().then(setScreenings).catch(err => setLoadError(err.message || 'Could not load Old Movies.'));
  }
  useEffect(() => { load(); }, []);

  if (loadError) {
    return (
      <section>
        <div className="section-head"><div className="dot"></div><h2>Old Movies</h2></div>
        <div className="empty">
          <span className="display">Couldn't load this section</span>
          {loadError}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={load}>Try Again</button>
          </div>
        </div>
      </section>
    );
  }

  if (!screenings) return null;

  if (!screenings.length) {
    return (
      <section>
        <div className="section-head"><div className="dot"></div><h2>Old Movies</h2></div>
        <div className="empty">
          <span className="display">Nothing shown yet</span>
          Once a movie night happens, it'll show up here permanently.
        </div>
      </section>
    );
  }

  const byYear = {};
  screenings.forEach(s => {
    const year = (s.shownDate || '').slice(0, 4) || 'Unknown';
    (byYear[year] = byYear[year] || []).push(s);
  });
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <section>
      <div className="section-head"><div className="dot"></div><h2>Old Movies</h2></div>
      {years.map(year => (
        <div key={year}>
          <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 26, color: 'var(--gold)', margin: '24px 0 10px' }}>{year}</h3>
          {byYear[year].map(s => (
            <MovieTicket key={s.screeningId} movie={s.movie}>
              <div className="vote-row" style={{ alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--slate)' }}>
                  Shown {new Date(s.shownDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {s.feedbackCount > 0 && (
                  <div className="avg-badge" style={{ margin: 0 }}>
                    <span className="num">{s.average.toFixed(1)}</span>
                    <span className="lbl">avg / {s.feedbackCount} rating{s.feedbackCount === 1 ? '' : 's'}</span>
                  </div>
                )}
              </div>
            </MovieTicket>
          ))}
        </div>
      ))}
    </section>
  );
}
