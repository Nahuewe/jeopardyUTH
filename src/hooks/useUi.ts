/* Qué paneles de edición están abiertos (estado de interfaz local, no se guarda). */

import { createContext, useContext } from 'react';

export interface Ui {
    editorOpen: boolean;
    creditsEditorOpen: boolean;
    openEditor: () => void;
    closeEditor: () => void;
    openCreditsEditor: () => void;
    closeCreditsEditor: () => void;
}

export const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
    const ui = useContext(UiContext);
    if (!ui) throw new Error('useUi fuera de UiProvider');
    return ui;
}
