import { useEffect, useState } from 'react';
import { onReplaced, reload } from '../platform';

/** One calm card when this build's files are gone; a reload always brings the newest build (D12). */
export function ReplacedCard() {
  const [shown, setShown] = useState(false);
  useEffect(() => onReplaced(() => setShown(true)), []);
  if (!shown) return null;
  return (
    <div className="replaced" role="alertdialog" aria-label="This build was replaced" data-testid="replaced-card">
      <span>This build was replaced</span>
      <button type="button" onClick={reload}>
        Reload
      </button>
    </div>
  );
}
