import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { watchChunkFailures } from './platform';
import { App } from './ui/App';
import { holdKeys } from './ui/brand/boot';
import { errors, installGlobalErrorHandlers } from './ui/errors';
import './ui/app.css';

watchChunkFailures(window);
installGlobalErrorHandlers(window, errors);
// The keyboard waits while the page's splash stands, as the game loads under it and as its bus tows it away (boot.ts).
holdKeys(window);

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
