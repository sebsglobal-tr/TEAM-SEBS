import { useState } from 'react';

export function AdminSettings() {
  const [maxFileSize, setMaxFileSize] = useState('25');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sistem Ayarları</h1>
        <p className="page-subtitle">Sistem genel yapılandırması</p>
      </div>

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

      <button className="btn btn-primary" onClick={handleSave}>
        {saved ? '✓ Kaydedildi' : 'Ayarları Kaydet'}
      </button>
    </div>
  );
}
