import { Card } from '../components/ui/Card';

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
}

export function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <Card>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
          Bu modül bir sonraki geliştirme aşamasında aktif olacaktır.
        </p>
      </Card>
    </div>
  );
}
