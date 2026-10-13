import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { watchChunkFailures } from './platform';
import { App } from './ui/App';
import './ui/app.css';

watchChunkFailures(window);

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
