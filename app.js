document.addEventListener('DOMContentLoaded', () => {
    // --- Navigation ---
    const navItems = document.querySelectorAll('.nav-item:not(.logout-item)');
    const sections = document.querySelectorAll('.app-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.getAttribute('data-section');
            
            // UI Update
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');

            // Refresh data when switching sections
            if (sectionId === 'section-consultas') loadConsultas();
            if (sectionId === 'section-entrega') loadEntrega();
            if (sectionId === 'section-ingresar') loadEspecialesList();
            if (sectionId === 'section-home') updateStats();
        });
    });

    // --- Date and Stats ---
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    const updateStats = async () => {
        const all = await getPedidos();
        const pendientes = all.filter(p => p.estado === 'pendiente').length;
        const entregadosHoy = all.filter(p => p.estado === 'entregado' && p.fechaEntrega === new Date().toISOString().split('T')[0]).length;
        
        document.getElementById('stat-pendientes').textContent = pendientes;
        document.getElementById('stat-entregados').textContent = entregadosHoy;
    };

    // --- Form: Ingresar Pedido ---
    const formPedido = document.getElementById('form-pedido');
    formPedido.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const pedido = {
            nombre: document.getElementById('nombre').value,
            regularPub: document.getElementById('regular-pub').value,
            regularCant: parseInt(document.getElementById('regular-cant').value) || 0,
            especialPub: document.getElementById('especial-pub').value,
            especialCant: parseInt(document.getElementById('especial-cant').value) || 0,
            fechaSolicitud: new Date().toISOString().split('T')[0],
            estado: 'pendiente'
        };

        if (pedido.regularCant === 0 && pedido.especialCant === 0) {
            alert('Por favor ingrese al menos una cantidad.');
            return;
        }

        try {
            await savePedido(pedido);
            alert('Pedido registrado con éxito');
            formPedido.reset();
            updateStats();
        } catch (error) {
            console.error(error);
            alert('Error al guardar el pedido');
        }
    });

    const loadEspecialesList = async () => {
        const especiales = await getEspeciales();
        const datalist = document.getElementById('especiales-list');
        datalist.innerHTML = '';
        especiales.forEach(esp => {
            const option = document.createElement('option');
            option.value = esp.nombre;
            datalist.appendChild(option);
        });
    };

    // --- Section: Entrega ---
    const loadEntrega = async (search = '') => {
        const list = await getPedidos('pendiente');
        const container = document.getElementById('list-entrega');
        container.innerHTML = '';

        const filtered = list.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()));

        filtered.forEach(p => {
            const row = document.createElement('tr');
            const items = [];
            if (p.regularCant > 0) items.push(`${p.regularPub} (${p.regularCant})`);
            if (p.especialCant > 0) items.push(`${p.especialPub} (${p.especialCant})`);

            row.innerHTML = `
                <td><strong>${p.nombre}</strong></td>
                <td>${items.join(' / ')}</td>
                <td>
                    <button class="btn-action btn-deliver" title="Confirmar Entrega" onclick="confirmarEntrega(${p.id})">
                        <i class="fas fa-check"></i>
                    </button>
                </td>
            `;
            container.appendChild(row);
        });
    };

    document.getElementById('search-entrega').addEventListener('input', (e) => {
        loadEntrega(e.target.value);
    });

    window.confirmarEntrega = async (id) => {
        if (confirm('¿Confirmar entrega de este pedido?')) {
            await updatePedido(id, {
                estado: 'entregado',
                fechaEntrega: new Date().toISOString().split('T')[0]
            });
            loadEntrega();
            updateStats();
        }
    };

    // --- Section: Consultas ---
    let consultaEstado = 'pendiente';

    document.getElementById('tab-pendientes').addEventListener('click', () => {
        consultaEstado = 'pendiente';
        document.getElementById('tab-pendientes').classList.add('active');
        document.getElementById('tab-entregados').classList.remove('active');
        document.getElementById('consulta-title').textContent = 'Pedidos Pendientes';
        document.getElementById('th-fecha-rel').textContent = 'Fecha Solicitud';
        document.getElementById('th-acciones').style.display = '';
        loadConsultas();
    });

    document.getElementById('tab-entregados').addEventListener('click', () => {
        consultaEstado = 'entregado';
        document.getElementById('tab-entregados').classList.add('active');
        document.getElementById('tab-pendientes').classList.remove('active');
        document.getElementById('consulta-title').textContent = 'Pedidos Entregados';
        document.getElementById('th-fecha-rel').textContent = 'Fecha Entrega';
        document.getElementById('th-acciones').style.display = 'none';
        loadConsultas();
    });

    const loadConsultas = async () => {
        const list = await getPedidos(consultaEstado);
        const container = document.getElementById('list-consultas');
        container.innerHTML = '';

        list.forEach(p => {
            const row = document.createElement('tr');
            const fechaAMostrar = consultaEstado === 'pendiente' ? p.fechaSolicitud : (p.fechaEntrega || '-');
            
            row.innerHTML = `
                <td>${fechaAMostrar}</td>
                <td>${p.nombre}</td>
                <td>${p.regularPub || '-'}</td>
                <td>${p.regularCant || 0}</td>
                <td>${p.especialPub || '-'}</td>
                <td>${p.especialCant || 0}</td>
                <td class="no-print">
                    ${consultaEstado === 'pendiente' ? `
                        <button class="btn-action btn-edit" onclick="abrirEditar(${p.id})">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="eliminarPedido(${p.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            container.appendChild(row);
        });
    };

    window.eliminarPedido = async (id) => {
        if (confirm('¿Está seguro de eliminar este pedido?')) {
            await deletePedido(id);
            loadConsultas();
            updateStats();
        }
    };

    // --- Edit Modal Logic ---
    const modal = document.getElementById('modal-edit');
    const closeBtn = document.querySelector('.close-modal');
    
    window.abrirEditar = async (id) => {
        const p = await getPedidoById(id);
        document.getElementById('edit-id').value = p.id;
        document.getElementById('edit-nombre').value = p.nombre;
        document.getElementById('edit-regular-pub').value = p.regularPub;
        document.getElementById('edit-regular-cant').value = p.regularCant;
        document.getElementById('edit-especial-pub').value = p.especialPub;
        document.getElementById('edit-especial-cant').value = p.especialCant;
        modal.style.display = 'flex';
    };

    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

    document.getElementById('form-edit').onsubmit = async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-id').value);
        const changes = {
            nombre: document.getElementById('edit-nombre').value,
            regularPub: document.getElementById('edit-regular-pub').value,
            regularCant: parseInt(document.getElementById('edit-regular-cant').value) || 0,
            especialPub: document.getElementById('edit-especial-pub').value,
            especialCant: parseInt(document.getElementById('edit-especial-cant').value) || 0
        };
        await updatePedido(id, changes);
        modal.style.display = 'none';
        loadConsultas();
    };

    // --- PDF Export ---
    document.getElementById('btn-pdf').addEventListener('click', () => {
        const element = document.getElementById('print-area');
        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     'Pedidos_Pendientes.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, backgroundColor: '#ffffff' },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        // Temporary styling for PDF to ensure it looks professional and clear
        const originalTable = document.getElementById('table-consultas');
        const pdfTable = originalTable.cloneNode(true);
        
        // Remove actions column from clone
        pdfTable.querySelectorAll('.no-print').forEach(el => el.remove());
        
        // Wrap in a div with PDF-specific styles
        const wrapper = document.createElement('div');
        wrapper.style.padding = '20px';
        wrapper.style.color = '#000';
        wrapper.style.backgroundColor = '#fff';
        
        const header = document.createElement('div');
        header.innerHTML = `
            <h1 style="text-align: center; margin-bottom: 5px;">Reporte de Pedidos ${consultaEstado === 'pendiente' ? 'Pendientes' : 'Entregados'}</h1>
            <p style="text-align: center; margin-bottom: 20px; color: #666;">Departamento de Publicaciones - Generado el ${new Date().toLocaleDateString()}</p>
        `;
        
        // Professional table styling for PDF
        const style = document.createElement('style');
        style.textContent = `
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 10px; font-size: 10pt; text-align: left; }
            td { border: 1px solid #cbd5e1; padding: 8px; font-size: 9pt; color: #000; }
            tr:nth-child(even) { background-color: #f8fafc; }
        `;
        
        wrapper.appendChild(style);
        wrapper.appendChild(header);
        wrapper.appendChild(pdfTable);

        html2pdf().from(wrapper).set(opt).save();
    });

    // --- Close App ---
    document.getElementById('btn-cerrar').addEventListener('click', () => {
        if (confirm('¿Desea cerrar la aplicación?')) {
            window.close();
            // Fallback for browsers that don't allow window.close()
            document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center; background:#0f172a; color:white; font-family:sans-serif;"><h1>Aplicación Cerrada</h1></div>';
        }
    });

    // --- Export / Import ---
    document.getElementById('btn-export').addEventListener('click', async () => {
        try {
            const data = await exportAllData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Publicaciones_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert('Error al exportar datos');
        }
    });

    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-import').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (confirm('¿Está seguro de importar estos datos? Esto reemplazará la información actual por la del archivo.')) {
                    await importAllData(data);
                    alert('Datos importados con éxito');
                    location.reload(); // Refresh to show new data
                }
            } catch (error) {
                console.error(error);
                alert('Error: El archivo no es válido.');
            }
        };
        reader.readAsText(file);
    });

    // Initial stats
    updateStats();
});
