interface BadgeProps {
  children: React.ReactNode;
  variant?: 'gold' | 'green' | 'red' | 'blue' | 'purple' | 'gray';
}

const variants = {
  gold: 'bg-gold-dim text-gold',
  green: 'bg-fangreen/10 text-fangreen',
  red: 'bg-fanred/10 text-fanred',
  blue: 'bg-fanblue/10 text-fanblue',
  purple: 'bg-fanpurple/10 text-fanpurple',
  gray: 'bg-white/5 text-white/60',
};

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
