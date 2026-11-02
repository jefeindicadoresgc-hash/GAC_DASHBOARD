import { db, collection, getDocs, query, where, doc, updateDoc, getDoc, addDoc } from './firebase-config.js';
import { generarPDFResultados } from './pdf_service.js';

const dmsRol = localStorage.getItem('dms_rol');
if (dmsRol !== 'ASESOR') window.location.href = 'index.html';

const tbodyAsesor = document.getElementById('tbodyAsesor');
const tbodyPendientes = document.getElementById('tbodyPendientes');
let citasDelDia = [], citasPendientes = [], citaEnVentana = null, kpiMarcaActual = 'GLOBAL';

const inputFiltro = document.getElementById('filtroFechaAsesor');
const filtroFecha = flatpickr(inputFiltro, {
    locale: "es", defaultDate: "today",
    disable: [function (date) { return (date.getDay() === 0 || date.getDay() === 6); }],
    onChange: function (selectedDates, dateStr) { cargarTablaRecepcion(dateStr); }
});
const hoy = new Date();
const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

// --- SISTEMA DE TABS Y KPIs ---
document.querySelectorAll('.side-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.side-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-tab');
        document.getElementById(targetId).style.display = 'block';
        if (targetId === 'tabPendientes') cargarUnidadesPendientes();
    });
});

document.querySelectorAll('.btn-kpi-filtro').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-kpi-filtro').forEach(b => { b.style.background = 'transparent'; b.style.color = 'var(--text-muted)'; });
        e.target.style.background = '#0f172a'; e.target.style.color = 'white';
        kpiMarcaActual = e.target.getAttribute('data-marca');
        actualizarKPIs();
    });
});

function actualizarKPIs() {
    let filtradas = kpiMarcaActual === 'GLOBAL' ? citasDelDia : citasDelDia.filter(c => c.marca === kpiMarcaActual);
    document.getElementById('kpi-citas').innerText = filtradas.length;
    document.getElementById('kpi-ingresos').innerText = filtradas.filter(c => ['Recepcionado', 'En Trabajo', 'Detenido', 'Terminado'].includes(c.status)).length;
    document.getElementById('kpi-noshow').innerText = filtradas.filter(c => c.status === 'No Show').length;
}

window.copiarVin = function (vin) {
    navigator.clipboard.writeText(vin).then(() => { Swal.fire({ title: 'Copiado', text: 'VIN copiado al portapapeles', icon: 'success', timer: 1000, showConfirmButton: false }); });
};

// ==========================================
// 1. CARGA DE TABLAS Y BUSCADOR GLOBAL
// ==========================================

// NUEVO: Buscador Global (Placa o VIN)
document.getElementById('btnBuscarGlobal').addEventListener('click', async () => {
    const val = document.getElementById('inpBusquedaGlobal').value.toUpperCase().trim();
    if (!val) { cargarTablaRecepcion(); return; } // Si está vacío, resetea a la fecha actual

    // Volver a la pestaña principal para ver resultados
    document.querySelector('[data-tab="tabRecepcion"]').click();
    tbodyAsesor.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Buscando en toda la base de datos...</td></tr>';

    try {
        let q;
        // Si el texto es largo, asume que es VIN, si no, Placa.
        if (val.length > 9) q = query(collection(db, "citas"), where("vin", "==", val));
        else q = query(collection(db, "citas"), where("placas", "==", val));

        const snap = await getDocs(q);
        let resultados = [];
        snap.forEach(d => { let data = d.data(); data.id = d.id; resultados.push(data); });

        if (resultados.length === 0) {
            tbodyAsesor.innerHTML = '<tr><td colspan="7" style="text-align: center; color:red;">No se encontró ningún vehículo con esa Placa o VIN.</td></tr>';
            return;
        }

        // Usamos la misma función de render para mostrar la búsqueda
        citasDelDia = resultados; // Temporalmente asignamos los resultados al array principal
        renderTableRows(resultados, tbodyAsesor, 'busqueda');
    } catch (e) {
        tbodyAsesor.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error en la búsqueda</td></tr>';
    }
});


async function cargarTablaRecepcion(fecha = inputFiltro.value) {
    if (!fecha) return;
    tbodyAsesor.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Actualizando tablero...</td></tr>';
    try {
        const snapshot = await getDocs(query(collection(db, "citas"), where("fecha", "==", fecha)));
        citasDelDia = [];
        snapshot.forEach(d => { const data = d.data(); data.id = d.id; citasDelDia.push(data); });
        citasDelDia.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
        actualizarKPIs();

        if (citasDelDia.length === 0) { tbodyAsesor.innerHTML = '<tr><td colspan="7" style="text-align: center; color:gray;">Sin citas registradas hoy.</td></tr>'; return; }
        renderTableRows(citasDelDia, tbodyAsesor, 'hoy');
    } catch (error) { tbodyAsesor.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error BD</td></tr>'; }
}

async function cargarUnidadesPendientes() {
    tbodyPendientes.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Buscando pendientes...</td></tr>';
    try {
        const snapshot = await getDocs(query(collection(db, "citas"), where("status", "in", ['Recepcionado', 'En Trabajo', 'Detenido', 'Terminado'])));
        citasPendientes = [];
        snapshot.forEach(d => {
            const data = d.data();
            if (data.fecha < hoyStr) { data.id = d.id; citasPendientes.push(data); }
        });
        citasPendientes.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        if (citasPendientes.length === 0) { tbodyPendientes.innerHTML = '<tr><td colspan="7" style="text-align: center; color:gray;">No hay vehículos rezagados.</td></tr>'; return; }
        renderTableRows(citasPendientes, tbodyPendientes, 'pendientes');
    } catch (e) { tbodyPendientes.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error BD</td></tr>'; }
}

function renderTableRows(arrayCitas, tbodyDOM, origen) {
    tbodyDOM.innerHTML = '';
    arrayCitas.forEach((c, index) => {
        const tagMarca = c.marca === 'GWM' ? '<span style="color:#0066CC; font-weight:900;">GWM</span>' : '<span style="color:#dc2626; font-weight:900;">GAC</span>';

        let badgeBg = '#f1f5f9', badgeCol = '#64748b';
        if (c.status === 'Recepcionado') { badgeBg = '#dbeafe'; badgeCol = '#1e3a8a'; }
        if (c.status === 'En Trabajo') { badgeBg = '#fef08a'; badgeCol = '#854d0e'; }
        if (c.status === 'Detenido') { badgeBg = '#fed7aa'; badgeCol = '#c2410c'; }
        if (c.status === 'Terminado') { badgeBg = '#dcfce7'; badgeCol = '#16a34a'; }
        if (c.status === 'Entregado') { badgeBg = '#10b981'; badgeCol = 'white'; }
        if (c.status === 'No Show') { badgeBg = '#fee2e2'; badgeCol = '#dc2626'; }

        // MUESTRA DE SERVICIO (Nuevo punto solicitado)
        const etiquetas = c.etiquetas ? c.etiquetas.join('') : '';
        const detalleResumen = c.detalle ? (c.detalle.length > 35 ? c.detalle.substring(0, 35) + '...' : c.detalle) : 'Sin detalle';
        const strServicio = `<span style="font-size:11px; font-weight:bold; color:#475569;">${etiquetas} ${detalleResumen}</span>`;

        const strHoraFecha = origen === 'hoy' ? `<strong>${c.hora || 'S/H'}</strong>` : `<strong>${c.fecha}</strong><br><span style="font-size:10px;">${c.hora || 'S/H'}</span>`;
        const tr = document.createElement('tr');
        if (c.status === 'No Show') tr.style.opacity = '0.6';
        if (c.status === 'Entregado') tr.style.background = 'rgba(220, 252, 231, 0.4)';

        tr.innerHTML = `
            <td>${strHoraFecha}</td>
            <td>${tagMarca}<br>${c.modelo}</td>
            <td><strong>${c.nombreCliente}</strong></td>
            <td style="font-size:11px;">
                <div style="font-weight:bold; font-size:13px; color:#0f172a;">${c.placas || 'S/P'}</div>
                <div style="color:gray;">${c.vin}</div>
                <button class="btn-copy-vin" onclick="copiarVin('${c.vin}')">Copiar VIN</button>
            </td>
            <td>${strServicio}</td>
            <td><span style="padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; background:${badgeBg}; color:${badgeCol};">${c.status || 'Agendada'}</span></td>
            <td style="text-align:center;">
                <button class="btn-abrir-ventana" data-origen="${origen}" data-index="${index}" style="background:#0f172a; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">⚙️ Ventana</button>
            </td>
        `;
        tbodyDOM.appendChild(tr);
    });

    document.querySelectorAll('.btn-abrir-ventana').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const origenBtn = e.target.getAttribute('data-origen');
            const index = e.target.getAttribute('data-index');
            // Si el origen fue la busqueda global, sacamos del arreglo citasDelDia que usamos temporalmente
            abrirVentanaMaster(origenBtn === 'pendientes' ? citasPendientes[index] : citasDelDia[index]);
        });
    });
}

// ==========================================
// 2. VENTANA MAESTRA (DELEGACIÓN DE EVENTOS BLINDADA)
// ==========================================
function abrirVentanaMaster(cita) {
    citaEnVentana = cita;
    document.getElementById('vmAutoCliente').innerText = `${cita.marca} ${cita.modelo} | ${cita.nombreCliente}`;
    const cajaBotones = document.getElementById('vmBotonesDinamicos');
    cajaBotones.innerHTML = '';

    const iconCheck = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    const iconEdit = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>`;
    const iconDoc = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`;
    const iconPlus = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`;
    const iconX = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    const iconMoney = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

    // BLINDAJE: Usamos data-actions para que el EventListener global los atrape
    if (cita.status === 'Agendada') {
        cajaBotones.innerHTML += `<button class="btn-pro-action primary" data-action="recepcionar">${iconEdit} Recepcionar Unidad</button>`;
        cajaBotones.innerHTML += `<button class="btn-pro-action danger" data-action="noshow">${iconX} Marcar No Show (Falta)</button>`;
    }

    // Opciones Post-Agendada (Siempre Visibles)
    if (['Recepcionado', 'En Trabajo', 'Detenido', 'Terminado', 'Entregado'].includes(cita.status)) {
        cajaBotones.innerHTML += `<button class="btn-pro-action" data-action="resultados">${iconDoc} Ver Checklist / Resultados</button>`;
        cajaBotones.innerHTML += `<button class="btn-pro-action warning" data-action="presupuestos">${iconMoney} Ver Presupuestos</button>`;

        if (cita.status !== 'Entregado') {
            cajaBotones.innerHTML += `<button class="btn-pro-action" data-action="adicional">${iconPlus} Agregar Trabajo Adicional</button>`;
            cajaBotones.innerHTML += `<button class="btn-pro-action success" data-action="entregar">${iconCheck} Entregar Unidad</button>`;
        } else {
            cajaBotones.innerHTML += `<div style="text-align:center; padding:15px; color:#10b981; font-weight:bold; border-top:1px solid #e2e8f0; margin-top:10px;">Unidad Entregada: ${cita.calificacionCliente}</div>`;
        }
    }
    if (cita.status === 'No Show') cajaBotones.innerHTML += `<div style="text-align:center; padding:20px; color:#ef4444; font-weight:bold;">El cliente fue marcado como Falta.</div>`;

    document.getElementById('modalVentanaMaster').style.display = 'flex';
}

// DELEGACIÓN DE EVENTOS (El Guardián del Modal)
document.getElementById('vmBotonesDinamicos').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-pro-action');
    if (!btn) return;

    const action = btn.getAttribute('data-action');

    if (action === 'recepcionar') {
        window.abrirRecepcion(); // Llama a la funcion global que ya tienes
    } else if (action === 'noshow') {
        marcarNoShow();
    } else if (action === 'resultados' || action === 'entregar') {
        abrirResultadosEntrega(action);
    } else if (action === 'presupuestos') {
        document.getElementById('modalVentanaMaster').style.display = 'none';
        document.querySelector('[data-tab="tabPresupuestos"]').click();
    } else if (action === 'adicional') {
        document.getElementById('modalVentanaMaster').style.display = 'none';
        document.getElementById('modalAdicional').style.display = 'flex';
    }
});

async function marcarNoShow() {
    if (!citaEnVentana) return;
    document.getElementById('modalVentanaMaster').style.display = 'none';
    if (await Swal.fire({ title: '¿Confirmar NO SHOW?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, confirmar' }).then(r => r.isConfirmed)) {
        await updateDoc(doc(db, "citas", citaEnVentana.id), { status: 'No Show', timestampNoShow: new Date().toISOString() });
        cargarTablaRecepcion();
    }
}

// ==========================================
// (Aquí abajo va el resto de tu código de Recepción y Cierre que ya funciona perfecto: abrirRecepcion, agregarFilaReparacion, etc.)
// ==========================================

// Te incluyo la función de abrir Resultados modificada para manejar la Entrega
window.abrirResultadosEntrega = async function (accion) {
    document.getElementById('modalVentanaMaster').style.display = 'none';
    const c = citaEnVentana;
    document.getElementById('entIdCita').value = c.id;

    try {
        const docSnap = await getDoc(doc(db, "inspecciones_tecnicas", c.id));
        let tecnicoData = docSnap.exists() ? docSnap.data() : null;

        document.getElementById('entComentariosTaller').value = (tecnicoData ? tecnicoData.comentarios : 'Sigue en taller o sin comentarios.') || '';

        // Mostrar o esconder el área de entrega según el botón que apretó
        if (accion === 'entregar') {
            document.getElementById('seccionCierreEntrega').style.display = 'block';
        } else {
            document.getElementById('seccionCierreEntrega').style.display = 'none';
        }

        document.getElementById('modalEntregaResultados').style.display = 'flex';

        // VINCULACIÓN AL PDF SERVICE
        document.getElementById('btnGenerarPDFChecklist').onclick = async () => {
            if (!tecnicoData) return Swal.fire('Aviso', 'El técnico aún no finaliza la inspección.', 'info');
            const nuevosComentarios = document.getElementById('entComentariosTaller').value;
            await updateDoc(doc(db, "inspecciones_tecnicas", c.id), { comentarios: nuevosComentarios });
            tecnicoData.comentarios = nuevosComentarios;
            await generarPDFResultados(c, tecnicoData);
        };

    } catch (err) { alert('Error al cargar resultados.'); }
};

// INICIALIZACIÓN
cargarTablaRecepcion();