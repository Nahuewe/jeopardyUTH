/* Qué paneles de edición están abiertos (estado de interfaz local, no se guarda). */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface Ui {
    editorOpen: boolean;
    creditsEditorOpen: boolean;
    openEditor: () => void;
    closeEditor: () => void;
    openCreditsEditor: () => void;
    closeCreditsEditor: () => void;
}

const UiContext = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
    const [editorOpen, setEditor] = useState(false);
    const [creditsEditorOpen, setCreditsEditor] = useState(false);

    const value = useMemo<Ui>(() => ({
        editorOpen, creditsEditorOpen,
        openEditor: () => setEditor(true),
        closeEditor: () => setEditor(false),
        openCreditsEditor: () => setCreditsEditor(true),
        closeCreditsEditor: () => setCreditsEditor(false)
    }), [editorOpen, creditsEditorOpen]);

    return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): Ui {
    const ui = useContext(UiContext);
    if (!ui) throw new Error('useUi fuera de UiProvider');
    return ui;
}
