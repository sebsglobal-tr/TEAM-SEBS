import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, User, CheckSquare, BarChart3, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface SearchResult {
  type: 'task' | 'user' | 'file' | 'report';
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const getBaseRoute = () => {
    if (!user) return '/employee';
    if (user.role === 'SUPER_ADMIN') return '/admin';
    if (user.role === 'MANAGER') return '/manager';
    return '/employee';
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim();
        const [tasks, users, files] = await Promise.all([
          api.get('/tasks', { params: { search: q, limit: '5' } }).catch(() => ({ data: [] })),
          api.get('/users', { params: { search: q } }).catch(() => ({ data: [] })),
          api.get('/files', { params: { search: q, limit: '5' } }).catch(() => ({ data: [] })),
        ]);

        const base = getBaseRoute();
        const allResults: SearchResult[] = [];

        const taskList = Array.isArray(tasks.data) ? tasks.data : [];
        taskList.slice(0, 5).forEach((t: any) => {
          allResults.push({
            type: 'task',
            id: t.id,
            title: t.title,
            subtitle: `${t.status || '-'} · ${t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : 'Atanmamış'}`,
            route: `${base}/tasks/${t.id}`,
          });
        });

        const userList = Array.isArray(users.data) ? users.data : [];
        userList.slice(0, 5).forEach((u: any) => {
          allResults.push({
            type: 'user',
            id: u.id,
            title: `${u.firstName} ${u.lastName}`,
            subtitle: u.email,
            route: `${base}/users/${u.id}`,
          });
        });

        const fileList = Array.isArray(files.data) ? files.data : [];
        fileList.slice(0, 5).forEach((f: any) => {
          allResults.push({
            type: 'file',
            id: f.id,
            title: f.originalName,
            subtitle: f.fileType || '-',
            route: `${base}/files`,
          });
        });

        setResults(allResults);
        setOpen(allResults.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, user, getBaseRoute]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    navigate(result.route);
  };

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const typeIcons: Record<string, any> = {
    task: CheckSquare,
    user: User,
    file: FileText,
    report: BarChart3,
  };

  const typeLabels: Record<string, string> = {
    task: 'Görev',
    user: 'Kullanıcı',
    file: 'Dosya',
    report: 'Rapor',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
      <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-secondary)', zIndex: 1 }} />
      <input
        ref={inputRef}
        className="form-input"
        style={{ paddingLeft: 36, fontSize: '0.82rem' }}
        placeholder="Görev, kullanıcı veya dosya ara..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
      />
      {query && (
        <button
          style={{
            position: 'absolute', right: 8, top: 8, background: 'none', border: 'none',
            color: 'var(--text-secondary)', cursor: 'pointer', padding: 2,
          }}
          onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
        >
          <X size={16} />
        </button>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          maxHeight: 400, overflowY: 'auto', zIndex: 1000,
        }}>
          {loading && (
            <div style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              Aranıyor...
            </div>
          )}
          {!loading && results.length === 0 && query && (
            <div style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              Sonuç bulunamadı
            </div>
          )}
          {results.map((r, i) => {
            const Icon = typeIcons[r.type];
            return (
              <div
                key={`${r.type}-${r.id}-${i}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.65rem',
                  padding: '0.6rem 1rem', cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.12s',
                }}
                onClick={() => handleSelect(r)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Icon size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    <span style={{
                      display: 'inline-block', padding: '0 4px', borderRadius: 3,
                      background: 'var(--accent-light)', marginRight: 4, fontWeight: 600,
                    }}>{typeLabels[r.type]}</span>
                    {r.subtitle}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
