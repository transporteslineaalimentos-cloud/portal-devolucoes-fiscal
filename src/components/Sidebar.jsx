import { useState } from 'react';

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const ICONS = {
  dashboard:  'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 3a4 4 0 100-8 4 4 0 000 8z',
  devolucoes: 'M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1',
  exit:       'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  chevronL:   'M15 18l-6-6 6-6',
  chevronR:   'M9 18l6-6-6-6',
};

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',   icon: ICONS.dashboard },
  { id: 'devolucoes', label: 'Devoluções',  icon: ICONS.devolucoes, badge: true },
];

export default function Sidebar({ tab, onChange, counts = {}, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const initials = user?.name
    ? user.name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
            <path d="M3 17V5h3l5 9 5-9h3v12h-2.5V9.5l-4.5 7.5h-3L5 9.5V17H3z" fill="#B8956A"/>
          </svg>
        </div>
        {!collapsed && (
          <div>
            <span className="sidebar-brand-name">Linea Alimentos</span>
            <span className="sidebar-brand-sub">Devoluções Fiscais</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {!collapsed && <div className="nav-section-label">Menu</div>}
        {NAV.map(item => (
          <button key={item.id} onClick={() => onChange(item.id)}
            className={`nav-item ${tab === item.id ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}>
            <span className="nav-icon-wrap"><Ic d={item.icon} /></span>
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
        {user && !collapsed && (
          <div className="sidebar-user" style={{ marginBottom: 4 }}>
            <div className="sidebar-user-avatar">{initials}</div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div className="sidebar-user-name">{user.name || user.email}</div>
              <div className="sidebar-user-role">{user.role}</div>
            </div>
          </div>
        )}

        <button onClick={onLogout} className="sidebar-toggle" title="Sair">
          <Ic d={ICONS.exit} size={14} />
          {!collapsed && <span style={{ fontSize: 11.5 }}>Sair</span>}
        </button>

        <button onClick={() => setCollapsed(v => !v)} className="sidebar-toggle"
          title={collapsed ? 'Expandir' : 'Recolher'}>
          <Ic d={collapsed ? ICONS.chevronR : ICONS.chevronL} size={14} />
          {!collapsed && <span style={{ fontSize: 11.5 }}>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
