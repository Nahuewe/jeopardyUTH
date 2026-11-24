import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/buzzer.css';
import { BuzzerApp } from './BuzzerApp.tsx';

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <BuzzerApp />
    </StrictMode>
);
