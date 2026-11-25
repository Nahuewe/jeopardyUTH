import { useMemo, useState, type ReactNode } from 'react';
import { UiContext, type Ui } from '../hooks/useUi.ts';

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
