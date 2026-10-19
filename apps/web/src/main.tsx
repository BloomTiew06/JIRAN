import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

// On a computer the app shows as a 390 × 844 phone; shrink it to fit shorter windows.
const fitPhone = () => {
  const z = Math.min(1, (window.innerHeight - 32) / 864, (window.innerWidth - 32) / 410);
  document.documentElement.style.setProperty('--phone-zoom', String(Math.max(0.5, z)));
};
fitPhone();
window.addEventListener('resize', fitPhone);
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
