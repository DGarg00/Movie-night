const PG_LABELS = {
  clean: { cls: 'pg-clean', label: "Clean — safe for all" },
  mild: { cls: 'pg-mild', label: 'Mild content' },
  caution: { cls: 'pg-caution', label: 'Caution advised' },
  strict: { cls: 'pg-strict', label: 'Strict screening needed' }
};

export default function MovieTicket({ movie, children }) {
  const pg = PG_LABELS[movie.pgTag] || PG_LABELS.mild;
  return (
    <div className="ticket">
      <div className="poster">
        {movie.poster
          ? <img src={movie.poster} alt={`${movie.title} poster`} />
          : <div className="placeholder">No poster<br />added</div>}
      </div>
      <div className="perf"></div>
      <div className="info">
        <div className="row1">
          <h3>{movie.title}</h3>
          <span className="imdb-badge">IMDb {movie.rating ?? '—'}</span>
        </div>
        <div className="meta-line">
          <span>{movie.genre || '—'}</span>
          <span>{movie.duration ? `${movie.duration} min` : '—'}</span>
          <span>{movie.language || '—'}</span>
          <span>{movie.year || '—'}</span>
        </div>
        <span className={`pg-tag ${pg.cls}`}>{pg.label}</span>
        {movie.pgDetail && <div className="pg-detail">{movie.pgDetail}</div>}
        <p className="storyline">{movie.storyline}</p>
        {children}
      </div>
    </div>
  );
}
