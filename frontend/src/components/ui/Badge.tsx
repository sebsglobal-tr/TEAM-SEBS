import './ui.css';

const VARIANT_MAP: Record<string, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  default: 'badge-default',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof VARIANT_MAP;
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span className={`badge ${VARIANT_MAP[variant]}`}>{children}</span>;
}
