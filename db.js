const DB_NAME = 'PublicacionesDB';
const DB_VERSION = 1;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Pedidos Store
            if (!db.objectStoreNames.contains('pedidos')) {
                const pedidosStore = db.createObjectStore('pedidos', { keyPath: 'id', autoIncrement: true });
                pedidosStore.createIndex('estado', 'estado', { unique: false });
                pedidosStore.createIndex('nombre', 'nombre', { unique: false });
            }

            // Publicaciones Especiales Store (to save names for future use)
            if (!db.objectStoreNames.contains('especiales')) {
                db.createObjectStore('especiales', { keyPath: 'nombre' });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

const savePedido = async (pedido) => {
    const db = await initDB();
    const transaction = db.transaction(['pedidos', 'especiales'], 'readwrite');
    
    // Save the order
    const pedidoRequest = transaction.objectStore('pedidos').add(pedido);
    
    // Save the special publication name if it exists
    if (pedido.especialPub && pedido.especialPub.trim() !== '') {
        transaction.objectStore('especiales').put({ nombre: pedido.especialPub.trim() });
    }

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(pedidoRequest.result);
        transaction.onerror = (event) => reject(event.target.error);
    });
};

const getPedidos = async (filtroEstado = null) => {
    const db = await initDB();
    const transaction = db.transaction(['pedidos'], 'readonly');
    const store = transaction.objectStore('pedidos');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            let data = request.result;
            if (filtroEstado) {
                data = data.filter(p => p.estado === filtroEstado);
            }
            resolve(data);
        };
        request.onerror = (event) => reject(event.target.error);
    });
};

const getEspeciales = async () => {
    const db = await initDB();
    const transaction = db.transaction(['especiales'], 'readonly');
    const store = transaction.objectStore('especiales');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

const updatePedido = async (id, changes) => {
    const db = await initDB();
    const transaction = db.transaction(['pedidos'], 'readwrite');
    const store = transaction.objectStore('pedidos');
    
    const getRequest = store.get(id);
    
    return new Promise((resolve, reject) => {
        getRequest.onsuccess = () => {
            const pedido = { ...getRequest.result, ...changes };
            const putRequest = store.put(pedido);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = (e) => reject(e.target.error);
        };
        getRequest.onerror = (e) => reject(e.target.error);
    });
};

const deletePedido = async (id) => {
    const db = await initDB();
    const transaction = db.transaction(['pedidos'], 'readwrite');
    const store = transaction.objectStore('pedidos');
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
};

const getPedidoById = async (id) => {
    const db = await initDB();
    const transaction = db.transaction(['pedidos'], 'readonly');
    const store = transaction.objectStore('pedidos');
    const request = store.get(id);

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

const exportAllData = async () => {
    const pedidos = await getPedidos();
    const especiales = await getEspeciales();
    return { pedidos, especiales, backupDate: new Date().toISOString() };
};

const importAllData = async (data) => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pedidos', 'especiales'], 'readwrite');
        const pedidosStore = transaction.objectStore('pedidos');
        const especialesStore = transaction.objectStore('especiales');
        
        // Merge or Replace? Let's use Put for merge-like behavior if they have IDs, 
        // or just clear and add for a full sync.
        pedidosStore.clear();
        especialesStore.clear();
        
        if (data.pedidos) {
            data.pedidos.forEach(p => {
                pedidosStore.put(p); // put keeps the ID if provided
            });
        }
        
        if (data.especiales) {
            data.especiales.forEach(e => especialesStore.put(e));
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
};
