import { useEffect, useState } from 'react';
import { onReplaced, reload } from '../platform';

/**
 * One calm card when this build's files are gone; a reload always brings the newest build (D12). A
 * game that failed for another reason (`failed`, copy.ts's failedText) says so in its own words on the same card, with the
 * same Reload, instead of a blank map: the replaced build's words are only for files that are gone.
 */
export function ReplacedCard({ failed = null }: { failed?: string | null }) {
  const [shown, setShown] = useState(false);
  useEffect(() => onReplaced(() => setShown(true)), []);
  const words = shown ? 'This build was replaced' : failed;
  if (!words) return null;
  return (
    <div className="replaced" role="alertdialog" aria-label={words} data-testid={shown ? 'replaced-card' : 'failed-card'}>
      <span>{words}</span>
      <button type="button" onClick={reload}>
        Reload
      </button>
    </div>
  );
}
