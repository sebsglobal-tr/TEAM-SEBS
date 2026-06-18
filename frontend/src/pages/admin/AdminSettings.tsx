import { useState, useEffect } from 'react';
import { settingsService } from '../../services/settings.service';

const SETTING_KEYS = {
  MAX_FILE_SIZE: 'MAX_FILE_SIZE_MB',
  DEFAULT_IDLE_THRESHOLD: 'DEFAULT_IDLE_THRESHOLD_MINUTES',
} as const;

export function AdminSettings() {
  const [maxFileSize, setMaxFileSize] = useState('25');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    settingsService.getAll()
      .then((data) => {
        const sizeSetting = data.find((s) => s.key === SETTING_KEYS.MAX_FILE_SIZE);
        if (sizeSetting) setMaxFileSize(sizeSetting.value);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await settingsService.update([
        { key: SETTING_KEYS.MAX_FILE_SIZE, value: maxFileSize },
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Ayarlar kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sistem Ayarları</h1>
        <p className="page-subtitle">Sistem genel yapılandırması</p>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-header"><div className="card-title">Dosya Ayarları</div></div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Maksimum Dosya Boyutu (MB)</label>
            <input
              type="number"
              className="form-input"
              style={{ maxWidth: 200 }}
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(e.target.value)}
              min={1}
              max={100}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Sistem Bilgisi</div></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div className="form-label">Sürüm</div>
              <div>1.0.0</div>
            </div>
            <div>
              <div className="form-label">Platform</div>
              <div>Web</div>
            </div>
            <div>
              <div className="form-label">Veritabanı</div>
              <div>PostgreSQL</div>
            </div>
            <div>
              <div className="form-label">Kimlik Doğrulama</div>
              <div>JWT</div>
            </div>
          </div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : 'Ayarları Kaydet'}
      </button>
    </div>
  );
}
