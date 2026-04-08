interface AvatarProps {
  url?: string;
  username: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export function Avatar({ url, username, size = 'md' }: AvatarProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={username}
        className={`${sizes[size]} rounded-full object-cover`}
      />
    );
  }

  const initial = username.charAt(0).toUpperCase();
  return (
    <div
      className={`${sizes[size]} rounded-full bg-fanpurple/20 text-fanpurple flex items-center justify-center font-semibold`}
    >
      {initial}
    </div>
  );
}
