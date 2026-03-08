interface MetricCardProps {
  value: number | string;
  label: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MetricCard({ value, label, suffix, className = '' }: MetricCardProps) {
  return (
    <div className={`metric-card ${className}`}>
      <div className="metric-value">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix && <span className="text-xl ml-1">{suffix}</span>}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

interface ProgressMetricCardProps extends MetricCardProps {
  total: number;
  current: number;
}

export function ProgressMetricCard({ value, label, total, current, className = '' }: ProgressMetricCardProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  
  return (
    <div className={`metric-card ${className}`}>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="mt-3 w-full bg-warm-200 rounded-full h-2">
        <div 
          className="bg-primary-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {current.toLocaleString()} of {total.toLocaleString()}
      </div>
    </div>
  );
}
