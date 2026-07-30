import { useState } from 'react';

export default function Collapsible({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button type="button" className="collapsible-head" onClick={() => setOpen(o => !o)}>
        <span className="dot"></span>
        <span className="collapsible-title">{title}</span>
        {badge && <span className="sub" style={{ marginLeft: 'auto', marginRight: 10 }}>{badge}</span>}
        <span className={`collapsible-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}