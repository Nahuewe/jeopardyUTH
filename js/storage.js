/* ================================
   STORAGE MODULE
   Manejo de IndexedDB y LocalStorage
================================ */

export const Storage = {
    DB_NAME: 'JeopardyDB',
    DB_VERSION: 1,
    STORE_NAME: 'roundsDataStore',

    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    },

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

    savePlayers(players) {
        localStorage.setItem("jeopardyPlayers", JSON.stringify(players));
    },

    loadPlayers() {
        const saved = localStorage.getItem("jeopardyPlayers");
        return saved ? JSON.parse(saved) : [];
    },

    saveTeams(teams) {
        localStorage.setItem("jeopardyTeams", JSON.stringify(teams));
    },

    loadTeams() {
        const saved = localStorage.getItem("jeopardyTeams");
        return saved ? JSON.parse(saved) : [];
    }
};
