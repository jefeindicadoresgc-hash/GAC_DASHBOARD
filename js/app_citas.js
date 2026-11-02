import { db, collection, addDoc, getDocs, query, where, doc, updateDoc } from './firebase-config.js';
import { catalogoServicios, obtenerPrecioServicio } from './data.js';

const dmsRol = localStorage.getItem('dms_rol');
const marcaActiva = localStorage.getItem('dms_marca');
if (dmsRol !== 'CITAS' || !marcaActiva) window.location.href = 'index.html';
document.getElementById('uiBrandName').innerText = `CITAS ${marcaActiva}`;

// Modales
const svgs = {
    error: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
    success: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    warning: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`
};
function mostrarModal(tipo, titulo, mensaje, callbackAceptar = null, callbackCancelar = null) {
    const modal = document.getElementById('customModal');
    document.getElementById('modalCard').className = `modal-card ${tipo}`;
    document.getElementById('modalIcon').innerHTML = svgs[tipo];
    document.getElementById('modalTitle').innerText = titulo;
    document.getElementById('modalMessage').innerText = mensaje;
    document.getElementById('modalBtnCancel').style.display = callbackCancelar ? 'block' : 'none';
    document.getElementById('modalBtnConfirm').innerText = callbackCancelar ? 'Sí, continuar' : 'Entendido';
    document.getElementById('modalBtnConfirm').onclick = () => { modal.style.display = 'none'; if (callbackAceptar) callbackAceptar(); };
    document.getElementById('modalBtnCancel').onclick = () => { modal.style.display = 'none'; if (callbackCancelar) callbackCancelar(); };
    modal.style.display = 'flex';
}

// 1. POBLAR SELECTS Y LOGICA FORMULARIO
const selectModelo = document.getElementById('modeloVehiculo');
const selectKm = document.getElementById('kmServicio');
catalogoServicios[marcaActiva].modelos.forEach(mod => selectModelo.appendChild(new Option(mod, mod)));
catalogoServicios[marcaActiva].kms.forEach(km => selectKm.appendChild(new Option(`${km.toLocaleString()} KM`, km)));

const chkMant = document.getElementById('chkMant'), chkRep = document.getElementById('chkRep'), chkDiag = document.getElementById('chkDiag');
const boxKm = document.getElementById('boxKm'), boxDiag = document.getElementById('boxDiag');
const displayPrecio = document.getElementById('precioEstimadoDisplay');

function evaluarFormulario() {
    const isMant = chkMant.checked, isRep = chkRep.checked, isDiag = chkDiag.checked;
    boxKm.style.display = isMant ? 'block' : 'none'; selectKm.required = isMant;
    boxDiag.style.display = (isRep || isDiag) ? 'block' : 'none'; document.getElementById('descDiagnostico').required = (isRep || isDiag);

    let precioBase = 0;
    if (isMant && selectModelo.value && selectKm.value) { precioBase = obtenerPrecioServicio(marcaActiva, selectModelo.value, parseInt(selectKm.value)); }

    if (!isMant && !isRep && !isDiag) { displayPrecio.style.display = 'none'; return; }
    displayPrecio.style.display = 'block';
    if (precioBase > 0 && (isRep || isDiag)) {
        displayPrecio.innerHTML = `Costo Estimado: <strong>$${precioBase.toLocaleString('es-MX')} + Revisión por definir</strong>`;
        displayPrecio.style.borderColor = '#fcd34d'; displayPrecio.style.background = 'rgba(254, 243, 199, 0.7)';
    } else if (precioBase > 0) {
        displayPrecio.innerHTML = `Costo Estimado: <strong>$${precioBase.toLocaleString('es-MX')} MXN</strong>`;
        displayPrecio.style.borderColor = '#bbf7d0'; displayPrecio.style.background = 'rgba(220, 252, 231, 0.7)';
    } else {
        displayPrecio.innerHTML = `Costo Estimado: <strong style="color:#d97706;">Por definir (Revisión técnica)</strong>`;
        displayPrecio.style.borderColor = '#fcd34d'; displayPrecio.style.background = 'rgba(254, 243, 199, 0.7)';
    }
}
[chkMant, chkRep, chkDiag, selectModelo, selectKm].forEach(el => el.addEventListener('change', evaluarFormulario));

window.toggleCamposFactura = function () {
    const reqFactura = document.getElementById('requiereFactura').value;
    const boxFact = document.getElementById('boxFacturacion');
    const inputFact = document.getElementById('datosFacturacion');
    if (reqFactura === 'Sí') { boxFact.style.display = 'block'; inputFact.required = true; }
    else { boxFact.style.display = 'none'; inputFact.required = false; inputFact.value = ''; }
}

flatpickr("#fechaCita", {
    locale: "es", minDate: "today", disable: [function (date) { return (date.getDay() === 0 || date.getDay() === 6); }],
    onChange: async function (selectedDates, dateStr) {
        const selectHora = document.getElementById('horaCita');
        selectHora.innerHTML = '<option value="">Buscando...</option>';
        try {
            const snapshot = await getDocs(query(collection(db, "citas"), where("fecha", "==", dateStr)));
            const horasOcupadas = snapshot.docs.map(doc => doc.data().hora);
            const ahora = new Date();
            const esHoy = (dateStr === `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`);
            const horaActualStr = ahora.toTimeString().substring(0, 5);

            selectHora.innerHTML = '<option value="">Seleccione hora libre...</option>';
            ["08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:30", "17:30"].forEach(hora => {
                const opt = document.createElement('option'); opt.value = hora;
                if (esHoy && hora <= horaActualStr) { opt.innerText = `${hora} - PASADA`; opt.disabled = true; }
                else if (horasOcupadas.includes(hora)) { opt.innerText = `${hora} - OCUPADO`; opt.disabled = true; }
                else { opt.innerText = `${hora} - Disponible`; }
                selectHora.appendChild(opt);
            });
        } catch (e) { selectHora.innerHTML = '<option value="">Error BD</option>'; }
    }
});

// --- SISTEMA DE PESTAÑAS (Tabs) EN EL PANEL DERECHO ---
const tabAgenda = document.getElementById('tabAgenda');
const tabNoShow = document.getElementById('tabNoShow');
const panelAgenda = document.getElementById('panelAgendaVisual');
const panelNoShow = document.getElementById('panelNoShowVisual');

tabAgenda.addEventListener('click', () => {
    tabAgenda.classList.add('active'); tabNoShow.classList.remove('active');
    panelAgenda.style.display = 'block'; panelNoShow.style.display = 'none';
    cargarPanelCitas(filtroAgenda.input.value);
});

tabNoShow.addEventListener('click', () => {
    tabNoShow.classList.add('active'); tabAgenda.classList.remove('active');
    panelNoShow.style.display = 'block'; panelAgenda.style.display = 'none';
    cargarBandejaNoShow();
});

// --- CARGA DE AGENDA NORMAL (Filtro Fecha) ---
const filtroAgenda = flatpickr("#filtroAgendaFecha", {
    locale: "es", defaultDate: "today",
    onChange: function (selectedDates, dateStr) { cargarPanelCitas(dateStr); }
});

async function cargarPanelCitas(fechaFiltro = null) {
    try {
        const panel = document.getElementById('listaCitasPanel');
        panel.innerHTML = '<p style="font-size:13px; color:gray;">Cargando...</p>';

        const ahora = new Date();
        const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
        const fechaVisualizar = fechaFiltro || hoyStr;

        const snapshot = await getDocs(query(collection(db, "citas"), where("fecha", "==", fechaVisualizar)));
        const snapHoy = await getDocs(query(collection(db, "citas"), where("fecha", "==", hoyStr)));

        let citasHoy = 0, diagHoy = 0, mantHoy = 0;
        snapHoy.forEach(doc => {
            const data = doc.data();
            // Para el BDC, sus KPIs solo reflejan SU marca
            if (data.marca === marcaActiva && data.status !== 'No Show') {
                citasHoy++;
                const etiquetas = data.etiquetas || [];
                if (etiquetas.includes('🔴') || etiquetas.includes('🟡')) diagHoy++;
                if (etiquetas.includes('🟢')) mantHoy++;
            }
        });

        let validas = 0; let cntGWM = 0, cntGAC = 0, cntMant = 0, cntDiag = 0;
        const arrayCitas = [];
        snapshot.forEach(doc => arrayCitas.push(doc.data()));
        arrayCitas.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

        panel.innerHTML = '';
        arrayCitas.forEach(c => {
            if (c.status === 'No Show') return; // Ocultamos los No Show de la agenda activa normal

            validas++;
            const etiquetas = c.etiquetas || [];
            if (c.marca === 'GWM') cntGWM++; else cntGAC++;
            if (etiquetas.includes('🟢')) cntMant++;
            if (etiquetas.includes('🔴') || etiquetas.includes('🟡')) cntDiag++;

            let detalleResumen = c.detalle ? (c.detalle.length > 35 ? c.detalle.substring(0, 35) + '...' : c.detalle) : '';
            let marcaTag = c.marca === 'GWM' ? '<span style="background:#0066CC; color:white; padding:2px 6px; border-radius:4px; font-size:10px;">GWM</span>' : '<span style="background:#dc2626; color:white; padding:2px 6px; border-radius:4px; font-size:10px;">GAC</span>';

            panel.innerHTML += `
                <div class="cita-card">
                    <strong style="display:flex; justify-content:space-between;"><span>${c.hora || 'S/H'} - ${c.fecha}</span> ${marcaTag}</strong>
                    <span><strong>Mod:</strong> ${c.modelo || ''}</span><br>
                    <span><strong>Servicio:</strong> ${etiquetas.join(' ')} ${detalleResumen}</span>
                </div>
            `;
        });

        if (validas === 0) {
            panel.innerHTML = '<p style="font-size:13px; color:gray;">Sin citas agendadas para esta fecha.</p>';
            document.getElementById('resumenDia').style.display = 'none';
        } else {
            document.getElementById('resGWM').innerText = cntGWM; document.getElementById('resGAC').innerText = cntGAC;
            document.getElementById('resMant').innerText = cntMant; document.getElementById('resDiag').innerText = cntDiag;
            document.getElementById('resumenDia').style.display = 'block';
        }

        document.getElementById('kpiCitasHoy').innerText = citasHoy;
        document.getElementById('kpiMantenimientos').innerText = mantHoy;
        document.getElementById('kpiDiagnosticos').innerText = diagHoy;
    } catch (e) { panel.innerHTML = '<p style="color:red;">Error al cargar.</p>'; }
}
cargarPanelCitas(filtroAgenda.input.value);

// --- CARGA DE RESCATE (NO SHOW) ---
async function cargarBandejaNoShow() {
    const panel = document.getElementById('listaNoShowPanel');
    panel.innerHTML = '<p style="font-size:13px; color:gray;">Buscando clientes...</p>';
    try {
        // Solo traemos los No Show de LA MARCA del BDC actual
        const q = query(collection(db, "citas"), where("marca", "==", marcaActiva), where("status", "==", "No Show"));
        const snapshot = await getDocs(q);
        let arrayNS = [];
        snapshot.forEach(doc => { let d = doc.data(); d.id = doc.id; arrayNS.push(d); });

        // Ordenamos del más reciente al más antiguo
        arrayNS.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

        if (arrayNS.length === 0) {
            panel.innerHTML = '<p style="font-size:13px; color:#16a34a; font-weight:bold;">¡Felicidades! Bandeja de rescate limpia.</p>';
            return;
        }

        panel.innerHTML = '';
        arrayNS.forEach(c => {
            panel.innerHTML += `
                <div class="cita-card" style="border-left:4px solid #ef4444;">
                    <strong style="color:#ef4444;">Falta original: ${c.fecha}</strong>
                    <span><strong>Cli:</strong> ${c.nombreCliente}</span><br>
                    <span><strong>Tel:</strong> <a href="https://wa.me/52${c.telefono}" target="_blank" style="color:#25D366; font-weight:bold; text-decoration:none;">${c.telefono} (WhatsApp)</a></span><br>
                    <span><strong>Auto:</strong> ${c.modelo}</span><br>
                    <button class="btn-reagendar" data-id="${c.id}" style="width:100%; margin-top:10px; background:#0f172a; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer;">📅 Reagendar Cliente</button>
                </div>
            `;
        });

        // Evento Reagendar (Pop-Up)
        document.querySelectorAll('.btn-reagendar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idDoc = e.target.getAttribute('data-id');
                const { value: nuevaFechaHora } = await Swal.fire({
                    title: 'Reagendar Cliente',
                    html: `
                        <p style="font-size:13px; color:gray;">Selecciona la nueva fecha y hora para el cliente.</p>
                        <input type="date" id="swal-fecha" class="swal2-input">
                        <select id="swal-hora" class="swal2-input">
                            <option value="08:30">08:30</option><option value="09:30">09:30</option><option value="10:30">10:30</option>
                            <option value="11:30">11:30</option><option value="12:30">12:30</option><option value="13:30">13:30</option>
                            <option value="14:30">14:30</option><option value="15:30">15:30</option><option value="16:30">16:30</option><option value="17:30">17:30</option>
                        </select>`,
                    focusConfirm: false,
                    showCancelButton: true, confirmButtonText: 'Guardar Cita',
                    preConfirm: () => {
                        const f = document.getElementById('swal-fecha').value;
                        const h = document.getElementById('swal-hora').value;
                        if (!f) Swal.showValidationMessage('Debes elegir una fecha.');
                        return { fecha: f, hora: h };
                    }
                });

                if (nuevaFechaHora) {
                    try {
                        await updateDoc(doc(db, "citas", idDoc), {
                            fecha: nuevaFechaHora.fecha,
                            hora: nuevaFechaHora.hora,
                            status: 'Agendada', // Lo regresa al estado activo
                            reagendado: true
                        });
                        Swal.fire('¡Reagendado!', 'La cita ha regresado a la Agenda Activa.', 'success');
                        cargarBandejaNoShow(); // Actualiza la lista
                    } catch (error) { Swal.fire('Error', 'Fallo al guardar en BD.', 'error'); }
                }
            });
        });

    } catch (e) { panel.innerHTML = '<p style="color:red;">Error de BD.</p>'; }
}

// 5. GUARDAR NUEVA CITA
document.getElementById('citaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!chkMant.checked && !chkRep.checked && !chkDiag.checked) return mostrarModal('error', 'Faltan datos', 'Selecciona un tipo de ingreso.');
    const actionId = e.submitter.id;
    const vin = document.getElementById('vin').value.toUpperCase();

    try {
        const snapVin = await getDocs(query(collection(db, "citas"), where("vin", "==", vin)));
        let duplicado = false;
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const lim = new Date(hoy); lim.setDate(lim.getDate() + 10);
        const fHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const fLim = `${lim.getFullYear()}-${String(lim.getMonth() + 1).padStart(2, '0')}-${String(lim.getDate()).padStart(2, '0')}`;

        snapVin.forEach(doc => { if (doc.data().fecha >= fHoy && doc.data().fecha <= fLim && doc.data().status !== 'No Show') duplicado = true; });

        if (duplicado) mostrarModal('warning', 'VIN Duplicado', `Ya existe cita. ¿Forzar registro?`, () => ejecutarGuardado(actionId), () => { });
        else ejecutarGuardado(actionId);
    } catch (err) { ejecutarGuardado(actionId); }
});

async function ejecutarGuardado(actionId) {
    const btnSubmit = document.getElementById(actionId);
    const textOrg = btnSubmit.innerText; btnSubmit.innerText = "Procesando..."; btnSubmit.disabled = true;

    const modelo = document.getElementById('modeloVehiculo').value;
    const km = parseInt(selectKm.value) || 0;
    const telefono = document.getElementById('telefono').value;
    const cliente = document.getElementById('nombreCliente').value;
    const fecha = document.getElementById('fechaCita').value;
    const hora = document.getElementById('horaCita').value;
    const metodoPago = document.getElementById('metodoPago').value;
    const requiereFactura = document.getElementById('requiereFactura').value;
    const datosFacturacion = document.getElementById('datosFacturacion').value;

    let precioBase = 0; let etiquetas = []; let detallesArray = [];

    if (chkMant.checked) { precioBase = obtenerPrecioServicio(marcaActiva, modelo, km); etiquetas.push('🟢'); detallesArray.push(`Mant ${km.toLocaleString()}K`); }
    if (chkRep.checked) etiquetas.push('🟡');
    if (chkDiag.checked) etiquetas.push('🔴');
    if (chkRep.checked || chkDiag.checked) detallesArray.push(document.getElementById('descDiagnostico').value.trim());

    const nuevaCita = {
        marca: marcaActiva, nombreCliente: cliente, vin: document.getElementById('vin').value.toUpperCase(),
        telefono: telefono, modelo: modelo, etiquetas: etiquetas, detalle: detallesArray.join(' | '),
        precioServicio: precioBase, costoExtra: (chkRep.checked || chkDiag.checked),
        fecha: fecha, hora: hora, metodoPago: metodoPago, requiereFactura: requiereFactura,
        datosFacturacion: requiereFactura === 'Sí' ? datosFacturacion : '',
        timestamp: new Date().toISOString(), status: 'Agendada'
    };

    try {
        await addDoc(collection(db, "citas"), nuevaCita);
        if (actionId === 'btnPDF') { mostrarModal('success', 'Éxito', 'Guardado. (PDF omitido en esta demo veloz)'); }
        else { mostrarModal('success', 'Éxito', 'Guardado. Abriendo WhatsApp...'); }
        document.getElementById('citaForm').reset(); evaluarFormulario(); cargarPanelCitas(filtroAgenda.input.value);
    } catch (e) { mostrarModal('error', 'Error BD', 'Fallo al guardar.'); }
    finally { btnSubmit.disabled = false; btnSubmit.innerText = textOrg; }
}

// 6. GENERACIÓN DE PRE-PICKING (Lee todo para unificar)
document.getElementById('btnPrepicking').addEventListener('click', async () => {
    const { value: fechaElegida } = await Swal.fire({ title: `Generar Pre-picking Taller`, text: 'Selecciona fecha:', input: 'date', confirmButtonText: 'Generar PDF', showCancelButton: true });
    if (!fechaElegida) return;
    try {
        const snapshot = await getDocs(query(collection(db, "citas"), where("fecha", "==", fechaElegida)));
        const citas = []; snapshot.forEach(d => { if (d.data().status !== 'No Show') citas.push(d.data()); });
        citas.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
        document.getElementById('prepFecha').innerText = fechaElegida;
        const tbody = document.getElementById('prepTablaBody'); tbody.innerHTML = '';
        if (citas.length === 0) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Vacio</td></tr>';
        else {
            citas.forEach(c => {
                let p = c.precioServicio > 0 ? `$${c.precioServicio.toLocaleString('es-MX')}` : 'Por definir';
                if (c.precioServicio > 0 && c.costoExtra) p += ' + Rev';
                tbody.innerHTML += `<tr><td style="padding:10px; border:1px solid #000;">${c.hora || ''}</td><td style="padding:10px; border:1px solid #000;"><strong>${c.marca}</strong><br>${c.modelo || ''}</td><td style="padding:10px; border:1px solid #000;">${(c.etiquetas || []).join('')} ${c.detalle || ''}</td><td style="padding:10px; border:1px solid #000; font-size:10px;">${c.vin}</td><td style="padding:10px; border:1px solid #000;">${p}</td></tr>`;
            });
        }
        document.getElementById('prepickingPlantilla').style.display = 'block';
        await html2pdf().set({ margin: 0.5, filename: `Prepicking_${fechaElegida}.pdf`, jsPDF: { orientation: 'landscape' } }).from(document.getElementById('prepickingPlantilla')).save();
        document.getElementById('prepickingPlantilla').style.display = 'none';
    } catch (e) { alert("Error PDF"); }
});