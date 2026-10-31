import { db, collection, addDoc, getDocs, query, where } from './firebase-config.js';
import { catalogoServicios, obtenerPrecioServicio } from './data.js';
import { cargarAgendaLateral } from './agenda.js';

const agenciaCode = localStorage.getItem('agencia_activa');
if (!agenciaCode) window.location.href = 'index.html';
const marcaActiva = agenciaCode === 'GWM1' ? 'GWM' : 'GAC';
document.getElementById('uiBrandName').innerText = `${marcaActiva} COATZACOALCOS`;

// --- MODALES (Se mantiene igual) ---
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

    document.getElementById('modalBtnConfirm').onclick = () => { modal.style.display = 'none'; if(callbackAceptar) callbackAceptar(); };
    document.getElementById('modalBtnCancel').onclick = () => { modal.style.display = 'none'; if(callbackCancelar) callbackCancelar(); };
    modal.style.display = 'flex';
}

// Selects
const selectModelo = document.getElementById('modeloVehiculo');
const selectKm = document.getElementById('kmServicio');
catalogoServicios[marcaActiva].modelos.forEach(mod => { selectModelo.appendChild(new Option(mod, mod)); });
catalogoServicios[marcaActiva].kms.forEach(km => { selectKm.appendChild(new Option(`${km.toLocaleString()} KM`, km)); });

function actualizarPrecio() {
    const modelo = selectModelo.value;
    const km = parseInt(selectKm.value);
    const display = document.getElementById('precioEstimadoDisplay');
    if (modelo && km) {
        const precio = obtenerPrecioServicio(marcaActiva, modelo, km);
        display.style.display = 'block';
        display.innerHTML = precio > 0 ? `Precio Estimado: <strong>$${precio.toLocaleString('es-MX')} MXN</strong>` : `Precio Estimado: <strong>A Cotizar</strong>`;
    } else { display.style.display = 'none'; }
}
selectModelo.addEventListener('change', actualizarPrecio);
selectKm.addEventListener('change', actualizarPrecio);

// --- FLATPICKR (Calendario Elegante que bloquea Fines de Semana) ---
flatpickr("#fechaCita", {
    locale: "es",
    minDate: "today",
    disable: [
        function(date) { return (date.getDay() === 0 || date.getDay() === 6); } // Bloquea Domingo y Sábado
    ],
    onChange: async function(selectedDates, dateStr, instance) {
        // Al seleccionar fecha, calculamos disponibilidad de horas
        const selectHora = document.getElementById('horaCita');
        selectHora.innerHTML = '<option value="">Buscando disponibilidad...</option>';
        
        const q = query(collection(db, "citas"), where("fecha", "==", dateStr));
        const snapshot = await getDocs(q);
        const horasOcupadas = snapshot.docs.map(doc => doc.data().hora);

        const ahora = new Date();
        const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`;
        const esHoy = (dateStr === hoyStr);
        const horaActualStr = ahora.toTimeString().substring(0, 5);

        selectHora.innerHTML = '<option value="">Seleccione hora disponible...</option>';
        ["08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:30", "17:30"].forEach(hora => {
            const opt = document.createElement('option');
            opt.value = hora;
            if (esHoy && hora <= horaActualStr) { opt.innerText = `${hora} - PASADA`; opt.disabled = true; } 
            else if (horasOcupadas.includes(hora)) { opt.innerText = `${hora} - OCUPADO`; opt.disabled = true; } 
            else { opt.innerText = `${hora} - Disponible`; }
            selectHora.appendChild(opt);
        });
    }
});

window.toggleFacturaFields = function() { document.getElementById('camposFactura').style.display = document.getElementById('requiereFactura').value === 'si' ? 'block' : 'none'; }

// --- GUARDAR CITA ---
document.getElementById('citaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const actionId = e.submitter.id;
    const vin = document.getElementById('vin').value.toUpperCase();
    const fecha = document.getElementById('fechaCita').value;

    try {
        const qVin = query(collection(db, "citas"), where("vin", "==", vin));
        const snapVin = await getDocs(qVin);
        
        let citaReciente = false;
        const hoy = new Date();
        const limiteStr = new Date(hoy.setDate(hoy.getDate() + 10)).toISOString().split('T')[0];
        const hoyStr = new Date().toISOString().split('T')[0];

        snapVin.forEach(doc => {
            const f = doc.data().fecha;
            if(f >= hoyStr && f <= limiteStr) citaReciente = true;
        });

        if (citaReciente) {
            mostrarModal('warning', 'Vehículo Duplicado', `El VIN ya tiene cita en los próximos 10 días. ¿Agendar otra?`, () => procesarGuardado(actionId), () => {});
        } else {
            procesarGuardado(actionId);
        }
    } catch (err) { procesarGuardado(actionId); }
});

async function procesarGuardado(actionId) {
    const btnSubmit = document.getElementById(actionId);
    const textoOriginal = btnSubmit.innerText;
    btnSubmit.innerText = "Procesando..."; btnSubmit.disabled = true;

    const modelo = document.getElementById('modeloVehiculo').value;
    const km = parseInt(document.getElementById('kmServicio').value);
    const precio = obtenerPrecioServicio(marcaActiva, modelo, km);
    const telefono = document.getElementById('telefono').value;
    const cliente = document.getElementById('nombreCliente').value;
    const fecha = document.getElementById('fechaCita').value;
    const hora = document.getElementById('horaCita').value;

    const nuevaCita = {
        marca: marcaActiva, nombreCliente: cliente, vin: document.getElementById('vin').value.toUpperCase(),
        telefono: telefono, modelo: modelo, kilometraje: km, precioServicio: precio, fecha: fecha, hora: hora,
        timestamp: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "citas"), nuevaCita);
        
        document.getElementById('tkMarca').innerText = `${marcaActiva} COATZACOALCOS`;
        document.getElementById('tkCliente').innerText = cliente;
        document.getElementById('tkVin').innerText = nuevaCita.vin;
        document.getElementById('tkModelo').innerText = modelo;
        document.getElementById('tkKm').innerText = km.toLocaleString();
        document.getElementById('tkFecha').innerText = fecha;
        document.getElementById('tkHora').innerText = hora;
        document.getElementById('tkCosto').innerText = precio > 0 ? `$${precio.toLocaleString('es-MX')} MXN` : 'A Cotizar';

        if (actionId === 'btnPDF') {
            const ticketDiv = document.getElementById('ticketImpresion');
            ticketDiv.style.display = 'block';
            await html2pdf().set({ margin: 1, filename: `Cita_${fecha}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter' } }).from(ticketDiv).save();
            ticketDiv.style.display = 'none';
            mostrarModal('success', '¡Cita Guardada!', 'La cita se registró y el PDF se descargó.');
        } else {
            const precioTxt = precio > 0 ? `$${precio.toLocaleString('es-MX')} MXN` : 'Sujeto a revisión';
            window.open(`https://wa.me/52${telefono}?text=Hola ${cliente}, confirmamos tu cita para tu ${modelo} en ${marcaActiva}.%0A📅 Fecha: ${fecha}%0A⏰ Hora: ${hora}%0A💰 Costo: ${precioTxt}`, '_blank');
            mostrarModal('success', '¡Cita Guardada!', 'Se registró y WhatsApp se abrió.');
        }

        document.getElementById('citaForm').reset();
        document.getElementById('precioEstimadoDisplay').style.display = 'none';
        cargarAgendaLateral(); 
        
    } catch (err) { mostrarModal('error', 'Error', 'Falla de conexión al guardar.'); }
    finally { btnSubmit.disabled = false; btnSubmit.innerText = textoOriginal; }
}

// --- NUEVO: FUNCIONALIDAD DE PRE-PICKING (PDF del día) ---
document.getElementById('btnPrepicking').addEventListener('click', async () => {
    const ahora = new Date();
    const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`;
    const fechaElegida = prompt("Generar Orden de Pre-picking.\n\nIngresa la fecha (Formato: AAAA-MM-DD):", hoyStr);
    
    if (!fechaElegida) return;

    try {
        const q = query(collection(db, "citas"), where("fecha", "==", fechaElegida));
        const snapshot = await getDocs(q);
        const citas = [];
        snapshot.forEach(doc => citas.push(doc.data()));
        
        citas.sort((a,b) => a.hora.localeCompare(b.hora));
        
        document.getElementById('prepFecha').innerText = fechaElegida;
        const tbody = document.getElementById('prepTablaBody');
        tbody.innerHTML = '';
        
        if (citas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;">No hay citas agendadas para este día.</td></tr>';
        } else {
            citas.forEach(c => {
                const precioTxt = c.precioServicio > 0 ? `$${c.precioServicio.toLocaleString('es-MX')}` : 'Cotizar';
                tbody.innerHTML += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #000;"><strong>${c.hora}</strong></td>
                        <td style="padding: 10px; border: 1px solid #000;">${c.marca} ${c.modelo}</td>
                        <td style="padding: 10px; border: 1px solid #000;">${c.kilometraje.toLocaleString()} km</td>
                        <td style="padding: 10px; border: 1px solid #000; text-transform: uppercase;">${c.vin}</td>
                        <td style="padding: 10px; border: 1px solid #000;">${precioTxt}</td>
                    </tr>
                `;
            });
        }

        const divPrep = document.getElementById('prepickingPlantilla');
        divPrep.style.display = 'block';
        await html2pdf().set({ margin: 0.5, filename: `Prepicking_${fechaElegida}.pdf`, jsPDF: { orientation: 'landscape' } }).from(divPrep).save();
        divPrep.style.display = 'none';
        
    } catch (e) {
        mostrarModal('error', 'Error BD', 'No se pudo generar el pre-picking.');
    }
});