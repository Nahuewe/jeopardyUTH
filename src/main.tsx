import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { UiProvider } from './hooks/useUi.tsx';
import { EngineProvider } from './hooks/useEngine.tsx';
import './styles/index.css';
import './styles/extras.css';
import './styles/theme.css';
import './styles/editor.css';
import './styles/credits.css';
import './styles/mobile.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <EngineProvider>
            <UiProvider><App /></UiProvider>
        </EngineProvider>
    </StrictMode>
);

// PWA: funciona sin conexión (solo en la versión compilada).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { });
}
