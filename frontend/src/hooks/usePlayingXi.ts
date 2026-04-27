import { useMemo } from 'react';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import type { PlayerWeightage } from '../types';

/** Normalize a player name for matching across slightly different spellings.
 * Lowercases, strips punctuation/diacritics, collapses whitespace. */
function norm(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * State for the announced-XI feature.
 *
 * Returns:
 * - announced: has the playing XI dropped for this match
 * - xi: the announced XI payload (team_a/b + xi_a/b name lists)
 * - xiNames: Set of normalized names for fast `isInXi(name)` lookups
 * - isInXi: helper that returns true if the given player name is in the XI
 * - bannerVisible: announced AND not dismissed this session
 * - benchedSelected: user's selected players who are NOT in the announced XI
 * - dismiss: hides the banner for the rest of this session
 */
export function usePlayingXi() {
  const xi = useRoomStore((s) => s.playingXi);
  const announcedAt = useRoomStore((s) => s.playingXiAnnouncedAt);
  const dismissed = useRoomStore((s) => s.playingXiBannerDismissed);
  const dismiss = useRoomStore((s) => s.dismissPlayingXiBanner);
  const game = useGameStore((s) => s.game);

  const xiNames = useMemo(() => {
    if (!xi) return new Set<string>();
    return new Set([...xi.xi_a, ...xi.xi_b].map(norm));
  }, [xi]);

  const isInXi = (name: string | undefined | null): boolean => {
    if (!xi || !name) return true;  // Pre-announcement, treat all players as "unknown / in" — no badge surfaces.
    return xiNames.has(norm(name));
  };

  const benchedSelected = useMemo<PlayerWeightage[]>(() => {
    if (!xi || !game) return [];
    return game.player_weightages.filter(
      (pw) => pw.selected && !xiNames.has(norm(pw.player_name)),
    );
  }, [xi, game, xiNames]);

  return {
    announced: !!xi,
    xi,
    announcedAt,
    xiNames,
    isInXi,
    bannerVisible: !!xi && !dismissed,
    benchedSelected,
    dismiss,
  };
}
