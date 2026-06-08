import { Card } from '../components/ui/Card';
import { Shield, Check, X } from 'lucide-react';

const COLLECTED = [
  'Çalışma başlangıç ve bitiş zamanları',
  'Aktif çalışma süresi (mouse/klavye kullanımı)',
  'Boşta (idle) süreleri',
  'Mola başlangıç ve bitiş zamanları',
  'Ekran kilitleme/açma olayları',
  'Görev durumu değişiklikleri',
  'Dosya yükleme kayıtları (metadata)',
  'Heartbeat ve event logları (manipülasyon önleme)',
];

const NOT_COLLECTED = [
  'Klavye tuş kayıtları (keylogger)',
  'Ekran görüntüleri',
  'Mikrofon veya kamera kaydı',
  'Kişisel dosya içerikleri',
  'Tarayıcı geçmişi',
  'Özel mesaj içerikleri',
  'Uygulama içeriği veya pencere başlıkları',
];

export function TransparencyPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Şeffaflık ve Veri Kullanımı</h1>
        <p className="page-subtitle">
          WorkTrack, KVKK uyumlu ve etik bir çalışma takip sistemidir.
          Tüm toplanan veriler size görünür ve erişilebilirdir.
        </p>
      </div>

      <div className="grid-2">
        <Card title="Toplanan Veriler" subtitle="Bu veriler sistem tarafından kaydedilir">
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {COLLECTED.map((item) => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <Check size={16} color="var(--success)" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Toplanmayan Veriler" subtitle="Bu veriler kesinlikle toplanmaz">
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {NOT_COLLECTED.map((item) => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <X size={16} color="var(--danger)" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Card title="Haklarınız">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <Shield size={24} color="var(--accent)" style={{ flexShrink: 0, marginTop: '0.25rem' }} />
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <p>Çalışma sürenizi ve toplanan tüm verileri bu panelden ve masaüstü agent uygulamasından görebilirsiniz.</p>
              <p style={{ marginTop: '0.75rem' }}>
                Verilerinize erişim, düzeltme veya silme talepleriniz için İnsan Kaynakları departmanıyla iletişime geçebilirsiniz.
                Sistem, çalışan habersiz izleme veya gizli takip amacı taşımaz.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
