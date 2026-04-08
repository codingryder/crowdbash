interface WeightageControlProps {
  value: number;
  canEdit: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
}

export function WeightageControl({
  value,
  canEdit,
  onIncrease,
  onDecrease,
  canIncrease,
  canDecrease,
}: WeightageControlProps) {
  return (
    <div className="flex items-center gap-2">
      {canEdit && (
        <button
          onClick={onDecrease}
          disabled={!canDecrease}
          className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-sm font-bold text-white/60 hover:text-white hover:bg-surface2 transition disabled:opacity-20 disabled:cursor-not-allowed"
        >
          -
        </button>
      )}

      <div className="w-8 text-center">
        <span
          className={`font-syne font-bold text-lg ${
            value > 0 ? 'text-gold' : 'text-white/20'
          }`}
        >
          {value}
        </span>
      </div>

      {canEdit && (
        <button
          onClick={onIncrease}
          disabled={!canIncrease}
          className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-sm font-bold text-white/60 hover:text-white hover:bg-surface2 transition disabled:opacity-20 disabled:cursor-not-allowed"
        >
          +
        </button>
      )}
    </div>
  );
}
