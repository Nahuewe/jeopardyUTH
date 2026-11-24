import qrcode from 'qrcode-generator';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import type { Engine } from '../engine/app.ts';
import { Dialog } from '../engine/dialog.ts';
import { Effects } from '../engine/effects.ts';
import type { GameState } from '../engine/gameState.ts';

const LABEL = { off: 'Apagado', starting: 'Conectando…', on: 'Activo', error: 'Error' } as const;

function Qr({ text }: { text: string }) {
    const [svg, setSvg] = useState('');
    useEffect(() => {
        try {
            const qr = qrcode(0, 'M');
            qr.addData(text);
            qr.make();
            setSvg(qr.createSvgTag(5, 2));
        } catch { setSvg(''); } // el QR es opcional
    }, [text]);
    // El SVG lo genera la librería a partir de nuestro propio link.
    return <div className="bz-qr" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Panel({ engine }: { engine: Engine }) {
    const { buzzer, state, live } = engine;
    useSyncExternalStore((cb) => buzzer.on('change', cb), () => buzzer.version);
    useSyncExternalStore((cb) => state.on('change', cb), () => state.version);
    const s = state.settings;
    const on = buzzer.status === 'on';
    const connected = live.data.connected;
    const [publicUrl, setPublicUrl] = useState(s.publicUrl);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(buzzer.link());
            Effects.toast('📋 Link copiado', 'success');
        } catch {
            (document.getElementById('bzLink') as HTMLInputElement | null)?.select();
            Effects.toast('Copiá el link con Ctrl+C', 'info');
        }
    };

    return (
        <div className="bz-panel" id="bzPanel">
            <p>Estado: <strong className={`bz-state bz-${buzzer.status}`}>{LABEL[buzzer.status]}</strong></p>
            {buzzer.error && <p className="bz-error">{buzzer.error}</p>}
            {on && (
                <>
                    <label className="bz-label">Link para los jugadores
                        <input id="bzLink" className="swal2-input" readOnly value={buzzer.link()} style={{ margin: '4px 0', width: '100%', boxSizing: 'border-box' }} />
                    </label>
                    <Qr text={buzzer.link()} />
                    <p className="bz-code">Código de sala: <strong>{s.roomCode}</strong></p>
                </>
            )}
            {buzzer.isLocalLink() && (
                <p className="bz-warn">⚠️ La app está en <code>{location.host}</code>: los celulares de otras redes no pueden abrir ese link.
                    Publicá la carpeta (GitHub Pages, Netlify…) y pegá abajo la URL pública.</p>
            )}
            <label className="bz-label">URL pública de la app (opcional)
                <input id="bzPublic" className="swal2-input" placeholder="https://usuario.github.io/jeopardy/" value={publicUrl}
                    onChange={e => setPublicUrl(e.target.value)}
                    onBlur={() => { if (publicUrl.trim() !== s.publicUrl) { s.publicUrl = publicUrl.trim(); state.commit(); } }}
                    style={{ margin: '4px 0', width: '100%', boxSizing: 'border-box' }} />
            </label>
            <ul className="bz-list">
                {state.players.length === 0 && <li><em>No hay jugadores todavía.</em></li>}
                {state.players.map(p => {
                    const here = connected.includes(p.id);
                    return <li key={p.id} className={here ? 'on' : ''}><span className="bz-dot" style={{ background: p.color }} />{p.name} <em>{here ? '📱 conectado' : '—'}</em></li>;
                })}
            </ul>
            <div className="bz-actions">
                <button className={on ? 'btn danger' : 'btn btn-save'}
                    onClick={() => { if (on || buzzer.status === 'starting') buzzer.stop(); else void buzzer.start(); }}>
                    {on || buzzer.status === 'starting' ? 'Desactivar buzzers' : 'Activar buzzers'}
                </button>
                {on && <button className="btn" onClick={() => void copy()}>📋 Copiar link</button>}
                {on && <button className="btn" onClick={() => void buzzer.newCode()}>🔁 Nuevo código</button>}
            </div>
        </div>
    );
}

/** Abre el diálogo de administración de los buzzers remotos. */
export function openBuzzerDialog(engine: Engine, _state?: GameState): void {
    void _state;
    let root: ReturnType<typeof createRoot> | null = null;
    void Dialog.fire({
        title: '📱 Buzzers remotos',
        html: '<div id="bzMount"></div>',
        showConfirmButton: false,
        showCloseButton: true,
        width: 560,
        didOpen: () => {
            root = createRoot(document.getElementById('bzMount')!);
            root.render(<Panel engine={engine} />);
        },
        willClose: () => { const r = root; root = null; setTimeout(() => r?.unmount(), 0); }
    });
}
