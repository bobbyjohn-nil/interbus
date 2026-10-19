import { useEffect, useState } from 'react';
import { onReplaced, reload } from '../platform';
import type { MapViewProps } from '../render/map/MapView';

/**
 * One calm card when this build's files are gone; a reload always brings the newest build (D12). While the game isn't saving
 * itself (`unsaved`, App's words, as the map's cards have them) it says so, with Export this game before Reload, so a reload never
 * loses unsaved play unsaid (the systems audit's seventh round: it offered Reload alone). A game that failed for another reason
 * (`failed`, copy.ts's failedText) says so in its own words on the same card, with the same Reload, instead of a blank map: the
 * replaced build's words are only for files that are gone.
 */
export function ReplacedCard({ failed = null, unsaved = null }: { failed?: string | null; unsaved?: MapViewProps['unsaved'] }) {
  const [shown, setShown] = useState(false);
  useEffect(() => onReplaced(() => setShown(true)), []);
  const words = shown ? 'This build was replaced' : failed;
  if (!words) return null;
  const keep = shown ? unsaved : null;
  return (
    <div className={keep ? 'replaced unsaved' : 'replaced'} role="alertdialog" aria-label={words} data-testid={shown ? 'replaced-card' : 'failed-card'}>
      <span>{keep ? `${words}. ${keep.words}` : words}</span>
      {keep ? (
        <button type="button" onClick={keep.onKeep}>
          {keep.keep}
        </button>
      ) : null}
      <button type="button" onClick={reload}>
        Reload
      </button>
    </div>
  );
}
