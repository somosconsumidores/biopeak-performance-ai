import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// Global error logging to help diagnose native issues
window.addEventListener('error', (e) => {
  console.error('GLOBAL ERROR:', e.message, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('UNHANDLED PROMISE REJECTION:', e.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
