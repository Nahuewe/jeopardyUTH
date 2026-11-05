/* ================================
   DATA TRANSFER
   Exportar / importar partidas (JSON) y preguntas (CSV)
================================ */

import { Dialog } from './dialog.js';
import { Effects } from './effects.js';
import { MediaStore } from './media.js';
import { Storage } from './storage.js';
import { makeQuestion, makeRound } from './gameState.js';
import { Utils, uid } from './utils.js';

const APP_ID = 'jeopardy-uth';
const CSV_HEADER = ['ronda', 'categoria', 'puntos', 'pregunta', 'respuesta', 'opciones', 'dailydouble'];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const stamp = () => new Date().toISOString().slice(0, 10);

export class DataTransfer {
    constructor(state) {
        this.state = state;
    }

    /* ---------- Exportar ---------- */

    async exportJSON() {
        const res = await Dialog.fire({
            title: 'Exportar partida',
            html: '<p style="text-align:left"><strong>Backup completo:</strong> rondas, medios, jugadores, equipos, puntajes y ajustes.<br><br><strong>Solo preguntas:</strong> rondas con medios, sin puntajes ni jugadores (ideal para compartir).</p>',
            showCancelButton: true, showDenyButton: true,
            confirmButtonText: 'Backup completo', denyButtonText: 'Solo preguntas', cancelButtonText: 'Cancelar',
            confirmButtonColor: '#27ae60', denyButtonColor: '#5865f2'
        });
        if (res.isDismissed) return;
        const full = res.isConfirmed;

        Swal.fire({ title: 'Preparando archivo…', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#2f3136', color: '#dcddde' });
        try {
            const rounds = [];
            for (const r of this.state.rounds) {
                const questions = [];
                for (const col of r.questions) {
                    const out = [];
                    for (const q of col) {
                        const copy = { ...q, media1: await this.#packMedia(q.media1), media2: await this.#packMedia(q.media2) };
                        if (!full) { copy.used = false; copy.usedWithOptions = false; }
                        out.push(copy);
                    }
                    questions.push(out);
                }
                rounds.push({ ...r, questions });
            }
            const payload = {
                app: APP_ID, version: 2, exportedAt: new Date().toISOString(), kind: full ? 'full' : 'questions',
                rounds,
                ...(full ? {
                    activeRoundId: this.state.activeRoundId,
                    players: this.state.players, teams: this.state.teams,
                    settings: this.state.settings, session: this.state.session
                } : {})
            };
            Utils.download(`jeopardy-${full ? 'backup' : 'preguntas'}-${stamp()}.json`, JSON.stringify(payload));
            Swal.close();
            Effects.toast('📦 Archivo exportado', 'success');
        } catch (e) {
            console.error(e);
            Swal.close();
            Dialog.info('No se pudo exportar', String(e.message || e), 'error');
        }
    }

    async #packMedia(m) {
        if (!m) return null;
        const data = await MediaStore.toDataURL(m);
        return data ? { type: m.type, data } : null;
    }

    async #unpackMedia(m) {
        if (!m) return null;
        if (m.data) return MediaStore.addFromDataURL(m.data, m.type);
        if (m.url?.startsWith?.('data:')) return MediaStore.addFromDataURL(m.url, m.type); // formato viejo
        return null;
    }

    /* ---------- Importar JSON ---------- */

    async importJSON() {
        const file = await Utils.pickFile('.json,application/json');
        if (!file) return;

        let data;
        try {
            data = JSON.parse(await file.text());
            if (data.app !== APP_ID || !Array.isArray(data.rounds)) throw new Error('El archivo no es una partida de Jeopardy UTH.');
        } catch (e) {
            return Dialog.info('Archivo inválido', e.message || 'No se pudo leer el JSON.', 'error');
        }

        const canReplace = data.kind === 'full';
        const res = await Dialog.fire({
            title: 'Importar partida',
            html: `<p style="text-align:left">${data.rounds.length} ronda(s)${canReplace ? `, ${data.players?.length ?? 0} jugador(es), ${data.teams?.length ?? 0} equipo(s)` : ''}.<br><br>
                <strong>Agregar rondas:</strong> suma las rondas a las que ya tenés.${canReplace ? '<br><strong>Reemplazar todo:</strong> borra la partida actual y carga el backup.' : ''}</p>`,
            showCancelButton: true, showDenyButton: canReplace,
            confirmButtonText: 'Agregar rondas', denyButtonText: 'Reemplazar todo', cancelButtonText: 'Cancelar',
            confirmButtonColor: '#27ae60', denyButtonColor: '#c0392b'
        });
        if (res.isDismissed) return;

        Swal.fire({ title: 'Importando…', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#2f3136', color: '#dcddde' });
        try {
            const rounds = [];
            for (const r of data.rounds) rounds.push(await this.#importRound(r, res.isDenied));

            if (res.isDenied) {
                this.state.history = [];
                this.state.load({ ...data, rounds });
                await Storage.collectGarbage(MediaStore.collectIds(this.state.rounds));
            } else {
                this.state.rounds.push(...rounds);
                this.state.activeRoundId = rounds[0]?.id ?? this.state.activeRoundId;
            }
            await MediaStore.preload(this.state.rounds.flatMap(r => r.questions.flat().flatMap(q => [q.media1, q.media2])));
            this.state.commit();
            Swal.close();
            Effects.toast('📥 Importación completa', 'success');
        } catch (e) {
            console.error(e);
            Swal.close();
            Dialog.info('Error al importar', String(e.message || e), 'error');
        }
    }

    async #importRound(r, keepIds) {
        const questions = [];
        for (const col of r.questions || []) {
            const out = [];
            for (const q of col) {
                out.push({
                    ...makeQuestion(Number(q.value) || 0),
                    question: q.question || '', answer: q.answer || '', multipleChoice: q.multipleChoice || '',
                    media1: await this.#unpackMedia(q.media1), media2: await this.#unpackMedia(q.media2),
                    dailyDouble: !!q.dailyDouble, used: !!q.used, usedWithOptions: !!q.usedWithOptions
                });
            }
            questions.push(out);
        }
        return {
            id: keepIds && r.id ? r.id : uid(),
            name: r.name || 'Ronda importada',
            mode: r.mode === 'team' ? 'team' : 'individual',
            categories: r.categories || [],
            questions
        };
    }

    /* ---------- CSV ---------- */

    downloadCSVTemplate() {
        const rows = [
            CSV_HEADER,
            ['Ronda 1', 'Geografía', 100, '¿Capital de Francia?', 'París', 'Madrid / París / Roma', 'no'],
            ['Ronda 1', 'Geografía', 200, '¿Río más largo de Sudamérica?', 'Amazonas', '', 'si'],
            ['Ronda 1', 'Ciencia', 100, '¿Símbolo químico del oro?', 'Au', '', 'no']
        ];
        Utils.download('plantilla-preguntas.csv', Utils.toCSV(rows), 'text/csv;charset=utf-8');
    }

    exportCSV() {
        const rows = [CSV_HEADER];
        for (const r of this.state.rounds) {
            r.categories.forEach((cat, c) => (r.questions[c] || []).forEach(q => {
                rows.push([r.name, cat, q.value, q.question, q.answer, q.multipleChoice, q.dailyDouble ? 'si' : 'no']);
            }));
        }
        Utils.download(`preguntas-${stamp()}.csv`, Utils.toCSV(rows), 'text/csv;charset=utf-8');
        Effects.toast('📄 CSV exportado (sin medios)', 'success');
    }

    async importCSV() {
        const file = await Utils.pickFile('.csv,text/csv');
        if (!file) return;

        const rows = Utils.parseCSV(await file.text());
        if (rows.length < 2) return Dialog.info('CSV vacío', 'No encontré filas de preguntas.', 'error');

        const head = rows[0].map(norm);
        const col = (name, fallback) => { const i = head.indexOf(name); return i >= 0 ? i : fallback; };
        const idx = {
            ronda: col('ronda', 0), categoria: col('categoria', 1), puntos: col('puntos', 2),
            pregunta: col('pregunta', 3), respuesta: col('respuesta', 4), opciones: col('opciones', 5), dd: col('dailydouble', 6)
        };
        if (head.indexOf('categoria') < 0 || head.indexOf('pregunta') < 0) {
            return Dialog.info('Formato no reconocido', 'La primera fila debe tener: ' + CSV_HEADER.join(', '), 'error');
        }

        const byRound = new Map();
        let count = 0;
        for (const row of rows.slice(1)) {
            const category = (row[idx.categoria] || '').trim();
            if (!category) continue;
            const rName = (row[idx.ronda] || '').trim() || 'Ronda importada';
            let round = byRound.get(rName);
            if (!round) {
                const mode = /grup|equip|team/i.test(rName) ? 'team' : 'individual';
                round = makeRound(rName, mode);
                byRound.set(rName, round);
            }
            let c = round.categories.indexOf(category);
            if (c < 0) { c = round.categories.length; round.categories.push(category); round.questions.push([]); }
            const flag = norm(row[idx.dd]);
            round.questions[c].push({
                ...makeQuestion(parseInt(row[idx.puntos], 10) || (round.questions[c].length + 1) * 100),
                question: row[idx.pregunta] || '', answer: row[idx.respuesta] || '', multipleChoice: row[idx.opciones] || '',
                dailyDouble: ['si', 'sí', 's', 'yes', 'y', '1', 'true', 'x'].includes(flag)
            });
            count++;
        }
        if (!count) return Dialog.info('Sin datos', 'No encontré preguntas válidas.', 'error');

        const added = [...byRound.values()];
        this.state.rounds.push(...added);
        this.state.activeRoundId = added[0].id;
        this.state.commit();
        Effects.toast(`📥 ${count} preguntas en ${added.length} ronda(s)`, 'success');
    }
}
