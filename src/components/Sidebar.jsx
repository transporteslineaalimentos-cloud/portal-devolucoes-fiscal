import { useState } from 'react';

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    className="nav-icon">
    <path d={d} />
  </svg>
);

const ICONS = {
  dashboard: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 3a4 4 0 100-8 4 4 0 000 8z',
  devolucoes:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zm-2 9H8m4 4H8',
  relatorio: 'M18 20V10M12 20V4M6 20v-6',
  exit:      'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  chevronL:  'M15 18l-6-6 6-6',
  chevronR:  'M9 18l6-6-6-6',
  moon:      'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
  sun:       'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 8a4 4 0 100 8 4 4 0 000-8z',
};

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',    icon: ICONS.dashboard },
  { id: 'devolucoes', label: 'Devoluções',   icon: ICONS.devolucoes, badge: true },
];

export default function Sidebar({ tab, onChange, counts = {}, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
          <rect width="28" height="28" rx="7" fill="#A68B5C" fillOpacity=".18"/>
          <path d="M6 20V8h3.5l4.5 9 4.5-9H22v12h-2.5v-8l-4 8h-3l-4-8v8H6z" fill="#A68B5C"/>
        </svg>
        {!collapsed && (
          <div>
            <span className="sidebar-brand-name">Linea</span>
            <span className="sidebar-brand-sub">Devoluções Fiscais</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`nav-item ${tab === item.id ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <Ic d={item.icon} />
            {!collapsed && (
              <>
                <span className="nav-label">{item.label}</span>
                {item.badge && counts[item.id] > 0 && (
                  <span className="nav-badge">{counts[item.id]}</span>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {user && (
          <button onClick={onLogout} className="sidebar-toggle" title="Sair">
            <Ic d={ICONS.exit} size={15} />
            {!collapsed && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || user.email}
              </span>
            )}
          </button>
        )}
        <button onClick={() => setCollapsed(v => !v)} className="sidebar-toggle" title={collapsed ? 'Expandir' : 'Recolher'}>
          <Ic d={collapsed ? ICONS.chevronR : ICONS.chevronL} size={15} />
          {!collapsed && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
