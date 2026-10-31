import { db, collection, addDoc, getDocs, query, where } from './firebase-config.js';
import { catalogoServicios, obtenerPrecioServicio } from './data.js';

// Verificación de Seguridad y Carga de Marca
const dmsRol = localStorage.getItem('dms_rol');
const marcaActiva = localStorage.getItem('dms_marca'); // "GWM" o "GAC"

if (dmsRol !== 'CITAS' || !marcaActiva) {
    window.location.href = 'index.html';
}

document.getElementById('uiBrandName').innerText = `CITAS ${marcaActiva}`;
document.getElementById('uiSubtitle').innerText = `Gestión de agenda para vehículos de ${marcaActiva} Coatzacoalcos`;

// --- MODALES (Compartido) ---
const svgs = {
    error: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
    success: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    warning: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`
};

function mostrarModal(tipo, titulo, mensaje, callbackAceptar = null, callbackCancelar = null) {
    const modal = document.getElementById('customModal');
    const card = document.getElementById('modalCard');
    card.className = `modal-card ${tipo}`;
    document.getElementById('modalIcon').innerHTML = svgs[tipo];
    document.getElementById('modalTitle').innerText = titulo;
    document.getElementById('modalMessage').innerText = mensaje;
    document.getElementById('modalBtnCancel').style.display = callbackCancelar ? 'block' : 'none';
    document.getElementById('modalBtnConfirm').innerText = callbackCancelar ? 'Sí, continuar' : 'Entendido';
    document.getElementById('modalBtnConfirm').onclick = () => { modal.style.display = 'none'; if (callbackAceptar) callbackAceptar(); };
    document.getElementById('modalBtnCancel').onclick = () => { modal.style.display = 'none'; if (callbackCancelar) callbackCancelar(); };
    modal.style.display = 'flex';
}

// 1. POBLAR SELECTS (Fijados a la marca del usuario)
const selectModelo = document.getElementById('modeloVehiculo');
const selectKm = document.getElementById('kmServicio');
catalogoServicios[marcaActiva].modelos.forEach(mod => selectModelo.appendChild(new Option(mod, mod)));
catalogoServicios[marcaActiva].kms.forEach(km => selectKm.appendChild(new Option(`${km.toLocaleString()} KM`, km)));

// 2. LÓGICA DE TIPO DE INGRESO (Mantenimiento vs Diagnóstico)
const tipoSelect = document.getElementById('tipoServicio');
const boxKm = document.getElementById('boxKm');
const boxDiag = document.getElementById('boxDiag');
const displayPrecio = document.getElementById('precioEstimadoDisplay');

function evaluarPrecio() {
    displayPrecio.style.display = 'block';
    if (tipoSelect.value === 'Diagnostico') {
        displayPrecio.innerHTML = `Costo Estimado: <strong style="color:#d97706;">Por definir (Revisión técnica)</strong>`;
        displayPrecio.style.borderColor = '#fcd34d';
        displayPrecio.style.background = 'rgba(254, 243, 199, 0.7)';
    } else {
        const modelo = selectModelo.value;
        const km = parseInt(selectKm.value);
        displayPrecio.style.borderColor = '#bbf7d0';
        displayPrecio.style.background = 'rgba(220, 252, 231, 0.7)';
        if (modelo && km) {
            const precio = obtenerPrecioServicio(marcaActiva, modelo, km);
            displayPrecio.innerHTML = precio > 0 ? `Costo Estimado: <strong>$${precio.toLocaleString('es-MX')} MXN</strong>` : `Costo Estimado: <strong>Por definir</strong>`;
        } else {
            displayPrecio.style.display = 'none';
        }
    }
}

tipoSelect.addEventListener('change', () => {
    if (tipoSelect.value === 'Mantenimiento') {
        boxKm.style.display = 'block'; boxDiag.style.display = 'none';
        document.getElementById('kmServicio').required = true;
        document.getElementById('descDiagnostico').required = false;
    } else {
        boxKm.style.display = 'none'; boxDiag.style.display = 'block';
        document.getElementById('kmServicio').required = false;
        document.getElementById('descDiagnostico').required = true;
    }
    evaluarPrecio();
});
selectModelo.addEventListener('change', evaluarPrecio);
selectKm.addEventListener('change', evaluarPrecio);

// 3. FLATPICKR (Calendario y Validación de Hora)
flatpickr("#fechaCita", {
    locale: "es", minDate: "today",
    disable: [function (date) { return (date.getDay() === 0 || date.getDay() === 6); }],
    onChange: async function (selectedDates, dateStr) {
        const selectHora = document.getElementById('horaCita');
        selectHora.innerHTML = '<option value="">Buscando disponibilidad...</option>';
        try {
            const q = query(collection(db, "citas"), where("fecha", "==", dateStr));
            const snapshot = await getDocs(q);
            const horasOcupadas = snapshot.docs.map(doc => doc.data().hora);

            const ahora = new Date();
            const esHoy = (dateStr === `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`);
            const horaActualStr = ahora.toTimeString().substring(0, 5);

            selectHora.innerHTML = '<option value="">Seleccione hora libre...</option>';
            ["08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:30", "17:30"].forEach(hora => {
                const opt = document.createElement('option');
                opt.value = hora;
                if (esHoy && hora <= horaActualStr) { opt.innerText = `${hora} - PASADA`; opt.disabled = true; }
                else if (horasOcupadas.includes(hora)) { opt.innerText = `${hora} - OCUPADO`; opt.disabled = true; }
                else { opt.innerText = `${hora} - Disponible`; }
                selectHora.appendChild(opt);
            });
        } catch (e) { selectHora.innerHTML = '<option value="">Error BD</option>'; }
    }
});

// 4. CARGAR AGENDA Y KPIs
async function cargarPanelCitas() {
    try {
        // En BDC cargamos SOLO las citas de SU marca
        const q = query(collection(db, "citas"), where("marca", "==", marcaActiva));
        const snapshot = await getDocs(q);

        const ahora = new Date();
        const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
        const horaAct = ahora.toTimeString().substring(0, 5);

        let citasHoy = 0, diagHoy = 0, mantHoy = 0;
        const panel = document.getElementById('listaCitasPanel'); panel.innerHTML = '';
        let validas = 0;

        const arrayCitas = [];
        snapshot.forEach(doc => arrayCitas.push(doc.data()));
        arrayCitas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

        arrayCitas.forEach(c => {
            // Contabilizar KPIs de Hoy
            if (c.fecha === hoyStr) {
                citasHoy++;
                if (c.tipoIngreso === 'Diagnostico') diagHoy++; else mantHoy++;
            }

            // Ocultar pasadas del panel lateral
            if (c.fecha < hoyStr || (c.fecha === hoyStr && c.hora < horaAct)) return;
            validas++;

            // Resumen de texto truncado para el panel (Max 35 caracteres)
            let detalleResumen = c.tipoIngreso === 'Diagnostico' ? c.detalle.substring(0, 35) + '...' : c.detalle;

            panel.innerHTML += `
                <div class="cita-card" style="border-left: 4px solid ${c.tipoIngreso === 'Diagnostico' ? '#d97706' : '#16a34a'}">
                    <strong>${c.hora} - ${c.fecha}</strong>
                    <span><strong>Cli:</strong> ${c.nombreCliente}</span><br>
                    <span><strong>Mod:</strong> ${c.modelo}</span><br>
                    <span><strong>Servicio:</strong> ${detalleResumen}</span>
                </div>
            `;
        });

        if (validas === 0) panel.innerHTML = '<p style="font-size:13px; color:gray;">Sin citas próximas agendadas.</p>';

        // Actualizar Tarjetas KPI
        document.getElementById('kpiCitasHoy').innerText = citasHoy;
        document.getElementById('kpiMantenimientos').innerText = mantHoy;
        document.getElementById('kpiDiagnosticos').innerText = diagHoy;

    } catch (e) { console.error(e); }
}
cargarPanelCitas();

// 5. GUARDAR CITA
document.getElementById('citaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const actionId = e.submitter.id;
    const vin = document.getElementById('vin').value.toUpperCase();

    // Validación VIN duplicado 10 días
    try {
        const snapVin = await getDocs(query(collection(db, "citas"), where("vin", "==", vin)));
        let duplicado = false;
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const lim = new Date(hoy); lim.setDate(lim.getDate() + 10);
        const fHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const fLim = `${lim.getFullYear()}-${String(lim.getMonth() + 1).padStart(2, '0')}-${String(lim.getDate()).padStart(2, '0')}`;

        snapVin.forEach(doc => { if (doc.data().fecha >= fHoy && doc.data().fecha <= fLim) duplicado = true; });

        if (duplicado) mostrarModal('warning', 'VIN Duplicado', `Ya existe cita reciente. ¿Deseas forzar el registro?`, () => ejecutarGuardado(actionId), () => { });
        else ejecutarGuardado(actionId);
    } catch (err) { ejecutarGuardado(actionId); }
});

async function ejecutarGuardado(actionId) {
    const btnSubmit = document.getElementById(actionId);
    const textOrg = btnSubmit.innerText; btnSubmit.innerText = "Procesando..."; btnSubmit.disabled = true;

    const tipoIngreso = tipoSelect.value;
    const modelo = document.getElementById('modeloVehiculo').value;
    const km = parseInt(document.getElementById('kmServicio').value) || 0;
    const telefono = document.getElementById('telefono').value;
    const cliente = document.getElementById('nombreCliente').value;
    const fecha = document.getElementById('fechaCita').value;
    const hora = document.getElementById('horaCita').value;

    let precio = 0;
    let detalleGuardar = "";

    if (tipoIngreso === 'Mantenimiento') {
        precio = obtenerPrecioServicio(marcaActiva, modelo, km);
        detalleGuardar = `Mantenimiento ${km.toLocaleString()} KM`;
    } else {
        precio = 0; // 0 equivale a "Por definir"
        detalleGuardar = document.getElementById('descDiagnostico').value.trim();
    }

    const nuevaCita = {
        marca: marcaActiva, nombreCliente: cliente, vin: document.getElementById('vin').value.toUpperCase(),
        telefono: telefono, modelo: modelo,
        tipoIngreso: tipoIngreso, detalle: detalleGuardar, // Nuevos campos dinámicos
        precioServicio: precio, fecha: fecha, hora: hora,
        timestamp: new Date().toISOString(), status: 'Agendada' // Estado inicial para que el asesor lo confirme después
    };

    try {
        await addDoc(collection(db, "citas"), nuevaCita);

        // Rellenar Plantilla Ticket PDF
        document.getElementById('tkMarca').innerText = `${marcaActiva} COATZACOALCOS`;
        document.getElementById('tkCliente').innerText = cliente;
        document.getElementById('tkVin').innerText = nuevaCita.vin;
        document.getElementById('tkModelo').innerText = modelo;
        document.getElementById('tkTipo').innerText = tipoIngreso === 'Diagnostico' ? 'Diagnóstico / Revisión' : 'Servicio Kilometrado';
        document.getElementById('tkDetalle').innerText = detalleGuardar;
        document.getElementById('tkFecha').innerText = fecha;
        document.getElementById('tkHora').innerText = hora;
        document.getElementById('tkCosto').innerText = precio > 0 ? `$${precio.toLocaleString('es-MX')} MXN` : 'Por definir (Requiere revisión técnica)';

        if (actionId === 'btnPDF') {
            const ticketDiv = document.getElementById('ticketImpresion'); ticketDiv.style.display = 'block';
            await html2pdf().set({ margin: 1, filename: `Cita_${marcaActiva}_${fecha}.pdf`, jsPDF: { unit: 'in', format: 'letter' } }).from(ticketDiv).save();
            ticketDiv.style.display = 'none';
            mostrarModal('success', 'Éxito', 'PDF descargado.');
        } else {
            const precioTxt = precio > 0 ? `$${precio.toLocaleString('es-MX')} MXN` : 'Por definir';
            window.open(`https://wa.me/52${telefono}?text=Hola ${cliente}, confirmamos tu cita de *${tipoIngreso}* para tu ${modelo} en ${marcaActiva}.%0A📅 Fecha: ${fecha}%0A⏰ Hora: ${hora}%0A💰 Costo Base: ${precioTxt}`, '_blank');
            mostrarModal('success', 'Éxito', 'Se guardó la cita y abrió WhatsApp.');
        }

        document.getElementById('citaForm').reset();
        displayPrecio.style.display = 'none';
        document.getElementById('boxDiag').style.display = 'none';
        document.getElementById('boxKm').style.display = 'block';
        cargarPanelCitas();
    } catch (e) { mostrarModal('error', 'Error BD', 'Fallo al guardar.'); }
    finally { btnSubmit.disabled = false; btnSubmit.innerText = textOrg; }
}

// 6. GENERACIÓN PRE-PICKING (Texto completo)
document.getElementById('btnPrepicking').addEventListener('click', async () => {
    const { value: fechaElegida } = await Swal.fire({
        title: `Pre-picking ${marcaActiva}`, text: 'Selecciona la fecha:', input: 'date',
        confirmButtonText: 'Generar PDF', confirmButtonColor: '#0f172a', showCancelButton: true
    });
    if (!fechaElegida) return;

    try {
        const q = query(collection(db, "citas"), where("marca", "==", marcaActiva), where("fecha", "==", fechaElegida));
        const snapshot = await getDocs(q);
        const citas = []; snapshot.forEach(d => citas.push(d.data()));
        citas.sort((a, b) => a.hora.localeCompare(b.hora));

        document.getElementById('prepFecha').innerText = fechaElegida;
        const tbody = document.getElementById('prepTablaBody'); tbody.innerHTML = '';

        if (citas.length === 0) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;">No hay citas agendadas.</td></tr>';
        else {
            citas.forEach(c => {
                const precioTxt = c.precioServicio > 0 ? `$${c.precioServicio.toLocaleString('es-MX')}` : 'Por definir';
                // AQUI VA EL TEXTO COMPLETO DEL DIAGNÓSTICO
                tbody.innerHTML += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #000; font-weight:bold;">${c.hora}</td>
                        <td style="padding: 10px; border: 1px solid #000;">${c.nombreCliente}<br><strong>${c.modelo}</strong></td>
                        <td style="padding: 10px; border: 1px solid #000;">${c.detalle}</td>
                        <td style="padding: 10px; border: 1px solid #000; text-transform:uppercase; font-size:10px;">${c.vin}</td>
                        <td style="padding: 10px; border: 1px solid #000; font-weight:bold;">${precioTxt}</td>
                    </tr>`;
            });
        }
        const divPrep = document.getElementById('prepickingPlantilla'); divPrep.style.display = 'block';
        await html2pdf().set({ margin: 0.5, filename: `Prepicking_${marcaActiva}_${fechaElegida}.pdf`, jsPDF: { orientation: 'landscape' } }).from(divPrep).save();
        divPrep.style.display = 'none';
    } catch (e) { mostrarModal('error', 'Error BD', 'No se pudo generar PDF.'); }
});