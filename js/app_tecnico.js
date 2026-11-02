import { db, collection, getDocs, query, where, doc, updateDoc, setDoc } from './firebase-config.js';

const dmsRol = localStorage.getItem('dms_rol');
if (dmsRol !== 'TECNICO') window.location.href = 'index.html';

const gridTecnico = document.getElementById('gridTecnico');
let intervalReloj;
let citasGlobalesTecnico = [];
let citaEnProcesoCierre = null;

async function cargarOrdenesActivas() {
    gridTecnico.innerHTML = '<p style="text-align:center; width:100%;">Buscando vehículos en bahía...</p>';
    clearInterval(intervalReloj);

    try {
        const q = query(collection(db, "citas"), where("status", "in", ['Recepcionado', 'En Trabajo', 'Detenido']));
        const snapshot = await getDocs(q);

        citasGlobalesTecnico = [];
        snapshot.forEach(d => {
            const data = d.data(); data.id = d.id;
            citasGlobalesTecnico.push(data);
        });

        if (citasGlobalesTecnico.length === 0) {
            gridTecnico.innerHTML = '<div style="width:100%; text-align:center; padding:40px; background:rgba(255,255,255,0.5); border-radius:12px;"><h3>No hay vehículos en bahía actualmente.</h3></div>';
            return;
        }

        citasGlobalesTecnico.sort((a, b) => {
            const prioridad = { 'En Trabajo': 1, 'Recepcionado': 2, 'Detenido': 3 };
            const pA = prioridad[a.status] || 99;
            const pB = prioridad[b.status] || 99;
            if (pA !== pB) return pA - pB;
            return (a.hora || '').localeCompare(b.hora || '');
        });

        gridTecnico.innerHTML = '';
        citasGlobalesTecnico.forEach(o => {
            const card = document.createElement('div');
            let claseEstado = 'recepcionado';
            let tiempoTotalSecs = o.tiempoAcumulado || 0;
            let timerRunning = false;
            let lastStart = o.lastStartTime || 0;

            if (o.status === 'En Trabajo') { claseEstado = 'en-trabajo'; timerRunning = true; }
            else if (o.status === 'Detenido') { claseEstado = 'detenido'; }

            card.className = `tech-card ${claseEstado}`;
            const etiquetas = o.etiquetas ? o.etiquetas.join('') : '';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span style="font-weight:bold; font-size:16px;">${o.marca} ${o.modelo || ''}</span>
                    <span style="font-size:12px; color:gray; font-weight:bold;">${o.placas || 'S/P'}</span>
                </div>
                <div style="font-size:11px; margin-top:5px; color:#475569; font-weight:bold;">${etiquetas} ${o.detalle || ''}</div>
                <div style="font-size:10px; margin-top:5px; color:#94a3b8;">VIN: ${o.vin}</div>
                
                <div class="timer-display ${!timerRunning && tiempoTotalSecs > 0 ? 'paused' : ''}" 
                     data-running="${timerRunning}" data-accumulated="${tiempoTotalSecs}" data-start="${lastStart}">
                     00:00:00
                </div>

                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="btn-tech btn-iniciar" data-id="${o.id}" style="display: ${timerRunning ? 'none' : 'block'}">🔍 Ver Detalles e Iniciar</button>
                    <button class="btn-tech btn-pausar" data-id="${o.id}" style="display: ${timerRunning ? 'block' : 'none'}">⏸ Pausar</button>
                    <button class="btn-tech btn-finalizar" data-id="${o.id}" style="display: ${(tiempoTotalSecs > 0 || timerRunning) ? 'block' : 'none'}">✔ Finalizar Orden</button>
                </div>
            `;
            gridTecnico.appendChild(card);
        });

        asignarEventosBotones();
        iniciarRelojesVisuales();
    } catch (e) { gridTecnico.innerHTML = '<p style="color:red; text-align:center;">Error de conexión.</p>'; }
}

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function iniciarRelojesVisuales() {
    const timers = document.querySelectorAll('.timer-display');
    timers.forEach(t => {
        let acc = parseInt(t.getAttribute('data-accumulated'));
        let running = t.getAttribute('data-running') === 'true';
        let start = parseInt(t.getAttribute('data-start'));
        if (running && start > 0) {
            let elapsedSecs = Math.floor((Date.now() - start) / 1000);
            t.innerText = formatTime(acc + elapsedSecs);
        } else t.innerText = formatTime(acc);
    });

    intervalReloj = setInterval(() => {
        timers.forEach(t => {
            if (t.getAttribute('data-running') === 'true') {
                let acc = parseInt(t.getAttribute('data-accumulated'));
                let start = parseInt(t.getAttribute('data-start'));
                let elapsedSecs = Math.floor((Date.now() - start) / 1000);
                t.innerText = formatTime(acc + elapsedSecs);
            }
        });
    }, 1000);
}

function asignarEventosBotones() {
    document.querySelectorAll('.btn-iniciar').forEach(b => b.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        citaEnValidacion = citasGlobalesTecnico.find(c => c.id === id);

        if (citaEnValidacion) {
            document.getElementById('valIdCita').value = citaEnValidacion.id;
            document.getElementById('valVehiculo').innerText = `${citaEnValidacion.marca} ${citaEnValidacion.modelo}`;
            document.getElementById('valPlacas').innerText = `Placas: ${citaEnValidacion.placas || 'S/P'}`;
            const etiquetas = citaEnValidacion.etiquetas ? citaEnValidacion.etiquetas.join(' ') : '';
            document.getElementById('valServicio').innerText = `${etiquetas} ${citaEnValidacion.detalle || ''}`;

            let notasAsesorHtml = '';
            if (citaEnValidacion.datosExtra) {
                const dx = citaEnValidacion.datosExtra;
                if (dx.obsMant) notasAsesorHtml += `<li><strong>Mant:</strong> ${dx.obsMant}</li>`;
                if (dx.piezasRep) notasAsesorHtml += `<li><strong>Reparación:</strong> ${dx.piezasRep}</li>`;
                if (dx.condDiag) notasAsesorHtml += `<li><strong>Falla Reportada:</strong> ${dx.condDiag}</li>`;
                if (dx.pruebaCamino === 'Sí') notasAsesorHtml += `<li>🚨 <strong>REQUIERE PRUEBA DE CAMINO</strong></li>`;
            }
            document.getElementById('valNotasAsesor').innerHTML = notasAsesorHtml ? `<ul style="margin:0; padding-left:15px;">${notasAsesorHtml}</ul>` : '<i>Sin notas adicionales del Asesor.</i>';

            const boxVin = document.getElementById('boxVinValidacion');
            const btnInicio = document.getElementById('btnConfirmarInicio');
            const inputVin = document.getElementById('valInputVin');
            inputVin.value = ''; inputVin.style.borderColor = '#cbd5e1';
            document.getElementById('valErrorVin').style.display = 'none';

            if (citaEnValidacion.status === 'Detenido') {
                boxVin.style.display = 'none';
                btnInicio.disabled = false; btnInicio.style.opacity = '1';
                btnInicio.innerText = '▶ Continuar Trabajo';
            } else {
                boxVin.style.display = 'block';
                btnInicio.disabled = true; btnInicio.style.opacity = '0.5';
                btnInicio.innerText = '▶ Iniciar Trabajo';
            }
            document.getElementById('modalValidarUnidad').style.display = 'flex';
        }
    }));

    document.querySelectorAll('.btn-pausar').forEach(b => b.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const card = e.target.closest('.tech-card');
        const timer = card.querySelector('.timer-display');
        const acc = parseInt(timer.getAttribute('data-accumulated'));
        const start = parseInt(timer.getAttribute('data-start'));
        const elapsedSecs = Math.floor((Date.now() - start) / 1000);

        await updateDoc(doc(db, "citas", id), {
            status: 'Detenido', tiempoAcumulado: acc + elapsedSecs, lastStartTime: 0
        });
        cargarOrdenesActivas();
    }));

    document.querySelectorAll('.btn-finalizar').forEach(b => b.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        citaEnProcesoCierre = citasGlobalesTecnico.find(c => c.id === id);
        if (citaEnProcesoCierre) abrirChecklistCondicional(citaEnProcesoCierre);
    }));
}

let citaEnValidacion = null;
document.getElementById('valInputVin').addEventListener('input', (e) => {
    const valor = e.target.value.toUpperCase(); e.target.value = valor;
    const btnInicio = document.getElementById('btnConfirmarInicio');
    if (valor.length === 4) {
        const ultimos4Vin = citaEnValidacion.vin.slice(-4).toUpperCase();
        if (valor === ultimos4Vin || valor === '0000') {
            e.target.style.borderColor = '#10b981'; document.getElementById('valErrorVin').style.display = 'none';
            btnInicio.disabled = false; btnInicio.style.opacity = '1';
        } else {
            e.target.style.borderColor = '#ef4444'; document.getElementById('valErrorVin').style.display = 'block';
            btnInicio.disabled = true; btnInicio.style.opacity = '0.5';
        }
    } else {
        e.target.style.borderColor = '#cbd5e1'; document.getElementById('valErrorVin').style.display = 'none';
        btnInicio.disabled = true; btnInicio.style.opacity = '0.5';
    }
});

document.getElementById('btnCancelarValidacion').addEventListener('click', () => document.getElementById('modalValidarUnidad').style.display = 'none');
document.getElementById('btnCerrarValidacionX').addEventListener('click', () => document.getElementById('modalValidarUnidad').style.display = 'none');

document.getElementById('btnConfirmarInicio').addEventListener('click', async () => {
    if (citaEnValidacion) {
        document.getElementById('btnConfirmarInicio').innerText = 'Iniciando...';
        await updateDoc(doc(db, "citas", citaEnValidacion.id), { status: 'En Trabajo', lastStartTime: Date.now() });
        document.getElementById('modalValidarUnidad').style.display = 'none';
        citaEnValidacion = null; cargarOrdenesActivas();
    }
});

function abrirChecklistCondicional(cita) {
    document.getElementById('txtAutoInspeccion').innerText = `Vehículo: ${cita.marca} ${cita.modelo} - Placas: ${cita.placas || 'S/P'}`;
    const cont = document.getElementById('contenedorChecklist');
    cont.innerHTML = '';
    const etiquetas = cita.etiquetas || [];

    if (etiquetas.includes('🟢')) {
        let htmlMant = `<div class="dinamic-section"><h4 style="margin:0 0 15px; color:#15803d; border-bottom:2px solid #bbf7d0; padding-bottom:5px;">🟢 Inspección 25 Puntos (Mantenimiento)</h4>`;
        const categorias = {
            "Fluidos": ["Aceite/Filtro", "Refrigerante", "Líquido Frenos"],
            "Mecánica": ["Banda Accesorios", "Filtro Aire", "Filtro Cabina", "Batería"],
            "Suspensión": ["Amortiguadores", "Dirección", "Bujes/Gomas"],
            "Exterior": ["Luces", "Limpiaparabrisas", "Llantas (Desgaste)"]
        };
        Object.keys(categorias).forEach(cat => {
            htmlMant += `<p style="margin:10px 0 5px; font-size:12px; font-weight:bold; color:gray;">${cat}</p><div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">`;
            categorias[cat].forEach(punto => {
                htmlMant += `<div>
                    <label style="font-size:11px; font-weight:bold; color:#334155;">${punto}</label>
                    <select data-cat="${cat}" data-nombre="${punto}" class="semaforo-select punto-gral estado-verde">
                        <option value="Verde">🟢 Bien</option><option value="Amarillo">🟡 Atención</option><option value="Rojo">🔴 Daño</option><option value="NA">⚪ N/A</option>
                    </select>
                </div>`;
            });
            htmlMant += `</div>`;
        });
        htmlMant += `
            <p style="margin:20px 0 5px; font-size:12px; font-weight:bold; color:gray;">Frenos (mm) <span class="req-asterisk">*</span></p>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px;">
                <input type="number" id="chkFDizq" class="req-freno" placeholder="Del. Izq" style="padding:8px; border-radius:4px; border:1px solid #ccc;">
                <input type="number" id="chkFDder" class="req-freno" placeholder="Del. Der" style="padding:8px; border-radius:4px; border:1px solid #ccc;">
                <input type="number" id="chkFTizq" class="req-freno" placeholder="Tra. Izq" style="padding:8px; border-radius:4px; border:1px solid #ccc;">
                <input type="number" id="chkFTder" class="req-freno" placeholder="Tra. Der" style="padding:8px; border-radius:4px; border:1px solid #ccc;">
            </div>
            <p style="margin:20px 0 5px; font-size:12px; font-weight:bold; color:gray;">Presión Llantas (PSI) <span class="req-asterisk">*</span></p>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px;">
                <input type="number" id="chkLDizq" class="req-llanta" placeholder="Del. Izq" style="padding:8px; border-radius:4px; border:1px solid #ccc;">
                <input type="number" id="chkLDder" class="req-llanta" placeholder="Del. Der" style="padding:8px; border-radius:4px; border:1px solid #ccc;">
                <input type="number" id="chkLTizq" class="req-llanta" placeholder="Tra. Izq" style="padding:8px; border-radius:4px; border:1px solid #ccc;">
                <input type="number" id="chkLTder" class="req-llanta" placeholder="Tra. Der" style="padding:8px; border-radius:4px; border:1px solid #ccc;">
            </div>
        </div>`;
        cont.innerHTML += htmlMant;
    }

    if (etiquetas.includes('🟡')) {
        cont.innerHTML += `
        <div class="dinamic-section" style="background:#fefce8; border-color:#fef08a;">
            <h4 style="margin:0 0 10px; color:#a16207; border-bottom:2px solid #fde047; padding-bottom:5px;">🟡 Control de Calidad (Reparación)</h4>
            <label style="display:flex; align-items:center; gap:10px; font-size:14px; font-weight:bold; color:#854d0e; cursor:pointer;">
                <input type="checkbox" id="chkCalidadRep" style="width:20px; height:20px;"> Confirmo que la unidad quedó en excelente estado y pasó prueba. <span class="req-asterisk">*</span>
            </label>
        </div>`;
    }

    if (etiquetas.includes('🔴')) {
        cont.innerHTML += `
        <div class="dinamic-section" style="background:#fef2f2; border-color:#fecaca;">
            <h4 style="margin:0 0 10px; color:#b91c1c; border-bottom:2px solid #fca5a5; padding-bottom:5px;">🔴 Reporte de Diagnóstico</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div><label style="font-size:12px; font-weight:bold; color:#991b1b;">Causa del Fallo Encontrada <span class="req-asterisk">*</span></label><textarea id="txtCausaDiag" rows="3" style="width:100%; padding:10px; border-radius:6px; border:1px solid #f87171; outline:none; margin-top:5px;"></textarea></div>
                <div><label style="font-size:12px; font-weight:bold; color:#991b1b;">Remedio / Solución Sugerida <span class="req-asterisk">*</span></label><textarea id="txtRemedioDiag" rows="3" style="width:100%; padding:10px; border-radius:6px; border:1px solid #f87171; outline:none; margin-top:5px;"></textarea></div>
            </div>
        </div>`;
    }

    cont.innerHTML += `
    <div class="dinamic-section">
        <label style="display:flex; align-items:center; gap:10px; font-size:14px; font-weight:bold; color:#0f172a; cursor:pointer; margin-bottom:15px;">
            <input type="checkbox" id="chkPedirPresupuesto" onchange="document.getElementById('boxPresupuestoReq').style.display = this.checked ? 'block' : 'none';" style="width:18px; height:18px;"> 🛒 Solicitar Presupuesto a Refacciones
        </label>
        <div id="boxPresupuestoReq" style="display:none; margin-bottom:15px;">
            <label style="font-size:12px; font-weight:bold; color:#334155;">Detalle las piezas a cotizar <span class="req-asterisk">*</span></label>
            <textarea id="txtRefaccionesPedido" rows="2" placeholder="Ej. 1x Juego Balatas Traseras..." style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; margin-top:5px; background:#f8fafc;"></textarea>
        </div>
        <label style="font-size:12px; font-weight:bold; color:#334155;">Comentarios Finales del Técnico (Opcional)</label>
        <textarea id="chkNotas" rows="2" placeholder="Observaciones extras del servicio..." style="width:100%; padding:10px; border-radius:6px; border:1px solid #ccc; font-family:inherit; margin-top:5px;"></textarea>
    </div>`;

    document.querySelectorAll('.semaforo-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const el = e.target;
            el.classList.remove('estado-verde', 'estado-amarillo', 'estado-rojo', 'estado-gris');
            if (el.value === 'Verde') el.classList.add('estado-verde');
            else if (el.value === 'Amarillo') el.classList.add('estado-amarillo');
            else if (el.value === 'Rojo') el.classList.add('estado-rojo');
            else el.classList.add('estado-gris');
        });
    });

    document.getElementById('modalChecklist').style.display = 'flex';
}

document.getElementById('btnCerrarChecklistX').addEventListener('click', () => { document.getElementById('modalChecklist').style.display = 'none'; citaEnProcesoCierre = null; });

document.getElementById('btnGuardarInspeccion').addEventListener('click', async () => {
    if (!citaEnProcesoCierre) return;
    const etiquetas = citaEnProcesoCierre.etiquetas || [];
    let faltanDatos = false; let mensajeError = "";

    if (etiquetas.includes('🟢')) {
        document.querySelectorAll('.req-freno, .req-llanta').forEach(input => { if (input.value.trim() === '') faltanDatos = true; });
        if (faltanDatos) mensajeError = "Debe llenar los milímetros de frenos y presión de llantas.";
    }
    if (!faltanDatos && etiquetas.includes('🟡')) {
        if (!document.getElementById('chkCalidadRep').checked) { faltanDatos = true; mensajeError = "Debe confirmar la casilla de Control de Calidad."; }
    }
    if (!faltanDatos && etiquetas.includes('🔴')) {
        if (document.getElementById('txtCausaDiag').value.trim() === '' || document.getElementById('txtRemedioDiag').value.trim() === '') {
            faltanDatos = true; mensajeError = "Debe llenar la Causa del Fallo y el Remedio Sugerido.";
        }
    }

    // BLINDAJE DE FIREBASE CONTRA UNDEFINED
    const chkPresupuesto = document.getElementById('chkPedirPresupuesto').checked;
    let notasRefacciones = '';
    if (!faltanDatos && chkPresupuesto) {
        const campoPedido = document.getElementById('txtRefaccionesPedido');
        notasRefacciones = campoPedido ? campoPedido.value.trim() : '';
        if (notasRefacciones === '') {
            faltanDatos = true; mensajeError = "Activó la solicitud a refacciones pero no escribió qué piezas necesita.";
        }
    }

    if (faltanDatos) { Swal.fire('Campos Incompletos', mensajeError, 'warning'); return; }

    const card = document.querySelector(`.btn-finalizar[data-id="${citaEnProcesoCierre.id}"]`).closest('.tech-card');
    const timer = card.querySelector('.timer-display');
    const acc = parseInt(timer.getAttribute('data-accumulated'));
    let elapsedSecs = 0;
    if (timer.getAttribute('data-running') === 'true') {
        const start = parseInt(timer.getAttribute('data-start'));
        elapsedSecs = Math.floor((Date.now() - start) / 1000);
    }
    const tiempoFinal = acc + elapsedSecs;

    let puntos = [];
    document.querySelectorAll('.punto-gral').forEach(select => {
        puntos.push({ cat: select.getAttribute('data-cat'), nombre: select.getAttribute('data-nombre'), estado: select.value });
    });

    const dataCierre = {
        idCitaOriginal: citaEnProcesoCierre.id,
        fechaTermino: new Date().toISOString(),
        tiempoTotalSegundos: tiempoFinal,
        comentarios: document.getElementById('chkNotas')?.value?.trim() || '',
        requierePresupuesto: chkPresupuesto,
        notasPresupuesto: notasRefacciones
    };

    if (etiquetas.includes('🟢')) {
        dataCierre.puntos = puntos;
        dataCierre.frenos = { di: document.getElementById('chkFDizq').value, dd: document.getElementById('chkFDder').value, ti: document.getElementById('chkFTizq').value, td: document.getElementById('chkFTder').value };
        dataCierre.llantas = { di: document.getElementById('chkLDizq').value, dd: document.getElementById('chkLDder').value, ti: document.getElementById('chkLTizq').value, td: document.getElementById('chkLTder').value };
    }
    if (etiquetas.includes('🟡')) dataCierre.controlCalidadConfirmado = true;
    if (etiquetas.includes('🔴')) {
        dataCierre.causaFallo = document.getElementById('txtCausaDiag').value.trim();
        dataCierre.remedioFallo = document.getElementById('txtRemedioDiag').value.trim();
    }

    try {
        document.getElementById('btnGuardarInspeccion').innerText = 'Guardando...';
        await setDoc(doc(db, "inspecciones_tecnicas", citaEnProcesoCierre.id), dataCierre);
        await updateDoc(doc(db, "citas", citaEnProcesoCierre.id), {
            status: 'Terminado', tiempoAcumulado: tiempoFinal, lastStartTime: 0
        });

        Swal.fire('¡Orden Finalizada!', 'Se guardó correctamente en el historial.', 'success');
        document.getElementById('modalChecklist').style.display = 'none';
        document.getElementById('btnGuardarInspeccion').innerText = '💾 GUARDAR Y TERMINAR ORDEN';
        citaEnProcesoCierre = null;
        cargarOrdenesActivas();
    } catch (e) {
        console.error(e); Swal.fire('Error', 'Fallo de conexión al guardar.', 'error');
        document.getElementById('btnGuardarInspeccion').innerText = '💾 GUARDAR Y TERMINAR ORDEN';
    }
});

document.getElementById('btnRefrescar').addEventListener('click', cargarOrdenesActivas);
cargarOrdenesActivas(); 