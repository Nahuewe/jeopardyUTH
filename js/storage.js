/* ================================
   STORAGE MODULE
   Manejo de IndexedDB y LocalStorage
================================ */

export const Storage = {
    DB_NAME: 'JeopardyDB',
    DB_VERSION: 2,
    STORE_NAME: 'roundsDataStore',
    PLAYERS_STORE_NAME: 'playersAndTeams',
    PLAYERS_KEY: 'jeopardyPlayers',
    TEAMS_KEY: 'jeopardyTeams',

    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(this.PLAYERS_STORE_NAME)) {
                    db.createObjectStore(this.PLAYERS_STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    },

    // --- MÉTODOS DE DATOS DEL JUEGO ---

    async saveGameData(roundsData) {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const dataToStore = { id: 'currentRoundsData', data: roundsData };
            store.put(dataToStore);

            await new Promise((resolve, reject) => {
                transaction.oncomplete = resolve;
                transaction.onerror = reject;
            });
            console.log("Datos guardados en IndexedDB.");
        } catch (error) {
            console.error("Error al guardar en IndexedDB:", error);
        }
    },

    async loadGameData() {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.get('currentRoundsData');

            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const result = event.target.result;
                    resolve(result ? result.data : null);
                };
                request.onerror = (event) => {
                    console.error("Error al cargar desde IndexedDB:", event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error("No se pudo conectar a IndexedDB.");
            return null;
        }
    },

    // --- MÉTODOS DE JUGADORES ---

    async savePlayers(players) {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.PLAYERS_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.PLAYERS_STORE_NAME);

            store.put({ id: this.PLAYERS_KEY, data: players });

            await new Promise((resolve, reject) => {
                transaction.oncomplete = resolve;
                transaction.onerror = reject;
            });
            console.log("Jugadores guardados en IndexedDB.");
        } catch (error) {
            console.error("Error al guardar jugadores en IndexedDB:", error);
        }
    },

    async loadPlayers() {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.PLAYERS_STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.PLAYERS_STORE_NAME);
            const request = store.get(this.PLAYERS_KEY);

            return new Promise((resolve) => {
                request.onsuccess = (event) => {
                    const result = event.target.result;
                    resolve(result ? result.data : []);
                };
                request.onerror = () => {
                    console.warn("No se pudieron cargar los jugadores. Usando lista vacía.");
                    resolve([]);
                };
            });
        } catch (error) {
            console.error("Error de conexión al cargar jugadores:", error);
            return [];
        }
    },

    // --- MÉTODOS DE EQUIPOS ---

    async saveTeams(teams) {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.PLAYERS_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.PLAYERS_STORE_NAME);

            store.put({ id: this.TEAMS_KEY, data: teams });

            await new Promise((resolve, reject) => {
                transaction.oncomplete = resolve;
                transaction.onerror = reject;
            });
            console.log("Equipos guardados en IndexedDB.");
        } catch (error) {
            console.error("Error al guardar equipos en IndexedDB:", error);
        }
    },

    async loadTeams() {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.PLAYERS_STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.PLAYERS_STORE_NAME);
            const request = store.get(this.TEAMS_KEY);

            return new Promise((resolve) => {
                request.onsuccess = (event) => {
                    const result = event.target.result;
                    resolve(result ? result.data : []);
                };
                request.onerror = () => {
                    console.warn("No se pudieron cargar los equipos. Usando lista vacía.");
                    resolve([]);
                };
            });
        } catch (error) {
            console.error("Error de conexión al cargar equipos:", error);
            return [];
        }
    }
};
