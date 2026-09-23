// indexeddb.js

const IDB_NAME = 'IT_UDONHOSP_DB';
const IDB_VERSION = 1;
const ASSET_STORE = 'ASSET_DATA';

let ITUDON_DB = null;

function openITUDONDB() {
    return new Promise((resolve, reject) => {

        if (ITUDON_DB) {
            resolve(ITUDON_DB);
            return;
        }

        const request = indexedDB.open(
            IDB_NAME,
            IDB_VERSION
        );

        request.onupgradeneeded = function(e) {

            const db = e.target.result;

            if (!db.objectStoreNames.contains(ASSET_STORE)) {

                db.createObjectStore(
                    ASSET_STORE,
                    {
                        keyPath: 'AssetID'
                    }
                );

            }
        };

        request.onsuccess = function(e) {

            ITUDON_DB = e.target.result;

            resolve(ITUDON_DB);
        };

        request.onerror = function(e) {

            reject(e.target.error);
        };

    });
}
