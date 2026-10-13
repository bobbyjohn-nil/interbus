import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { watchChunkFailures } from './platform';
import { App } from './ui/App';
import { errors, installGlobalErrorHandlers } from './ui/errors';
import './ui/app.css';

watchChunkFailures(window);
installGlobalErrorHandlers(window, errors);

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
