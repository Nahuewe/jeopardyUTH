/* Emisor de eventos mínimo y tipado por nombre de evento. */

type Handler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
    #handlers = new Map<keyof Events, Set<Handler<never>>>();

    on<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
        let set = this.#handlers.get(event);
        if (!set) this.#handlers.set(event, (set = new Set()));
        set.add(fn as Handler<never>);
        return () => this.off(event, fn);
    }

    off<K extends keyof Events>(event: K, fn: Handler<Events[K]>): void {
        this.#handlers.get(event)?.delete(fn as Handler<never>);
    }

    emit<K extends keyof Events>(event: K, payload: Events[K]): void {
        this.#handlers.get(event)?.forEach(fn => {
            try { (fn as Handler<Events[K]>)(payload); } catch (e) { console.error(`[EventBus] error en "${String(event)}":`, e); }
        });
    }
}
