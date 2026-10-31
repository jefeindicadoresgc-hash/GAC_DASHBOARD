import { db, doc, setDoc, getDoc } from './firebase-config.js';
import { catalogoServicios } from './data.js';

// Verificación estricta de seguridad
const dmsRol = localStorage.getItem('dms_rol');
if (dmsRol !== 'TECNICO') {
    window.location.href = 'index.html';
}

// --- SISTEMA DE MODALES (Misma lógica compartida) ---
const svgs = {
    error: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
    success: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    warning: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`
};

function mostrarModal(tipo, titulo, mensaje) {
    const modal = document.getElementById('customModal');
    const card = document.getElementById('modalCard');
    card.className = `modal-card ${tipo}`;
    document.getElementById('modalIcon').innerHTML = svgs[tipo];
    document.getElementById('modalTitle').innerText = titulo;
    document.getElementById('modalMessage').innerText = mensaje;

    document.getElementById('modalBtnCancel').style.display = 'none';
    document.getElementById('modalBtnConfirm').innerText = 'Entendido';
    document.getElementById('modalBtnConfirm').onclick = () => modal.style.display = 'none';

    modal.style.display = 'flex';
}

// 1. POBLAR SELECT DE MODELOS AGRUPADOS (GWM y GAC)
const selectModelo = document.getElementById('modelo');
const grpGWM = document.createElement('optgroup'); grpGWM.label = "Great Wall Motors";
catalogoServicios["GWM"].modelos.forEach(m => grpGWM.appendChild(new Option(m, `GWM ${m}`)));
selectModelo.appendChild(grpGWM);

const grpGAC = document.createElement('optgroup'); grpGAC.label = "GAC Motor";
catalogoServicios["GAC"].modelos.forEach(m => grpGAC.appendChild(new Option(m, `GAC ${m}`)));
selectModelo.appendChild(grpGAC);

// 2. GENERAR CHECKLIST DINÁMICO
const categorias = {
    "Mecánica y Fluidos": ["Refrigerante / Batería", "Transmisión / Motor", "Soportes de Motor", "Tubería de Escape"],
    "Suspensión y Dirección": ["Rótulas y guardapolvos", "Amortiguadores", "Caja de dirección", "Terminales"],
    "Carrocería y Visibilidad": ["Luces Delanteras/Niebla", "Luces Traseras/Freno", "Intermitentes", "Limpiaparabrisas", "Cristales y Espejos", "Claxon"]
};

const contPuntos = document.getElementById('contenedor-puntos');
Object.keys(categorias).forEach(cat => {
    let html = `<h3 class="section-title">${cat}</h3><div class="form-grid">`;
    categorias[cat].forEach(punto => {
        html += `
        <div class="form-group">
            <label>${punto}</label>
            <select data-cat="${cat}" data-nombre="${punto}" class="semaforo-select punto-gral">
                <option value="Verde">🟢 Óptimo / Bien</option>
                <option value="Amarillo">🟡 Sugerencia / Atención</option>
                <option value="Rojo">🔴 Urgente / Dañado</option>
                <option value="NA">⚪ N/A (No Aplica)</option>
            </select>
        </div>`;
    });
    html += `</div>`;
    contPuntos.innerHTML += html;
});

// 3. CAMBIO DE COLORES DEL SEMÁFORO
function aplicarColorSelect(selectElement) {
    selectElement.classList.remove('estado-verde', 'estado-amarillo', 'estado-rojo', 'estado-gris');
    if (selectElement.value === 'Verde') selectElement.classList.add('estado-verde');
    else if (selectElement.value === 'Amarillo') selectElement.classList.add('estado-amarillo');
    else if (selectElement.value === 'Rojo') selectElement.classList.add('estado-rojo');
    else if (selectElement.value === 'NA') selectElement.classList.add('estado-gris');
}

document.querySelectorAll('.semaforo-select').forEach(sel => {
    aplicarColorSelect(sel); // Aplicar color inicial
    sel.addEventListener('change', (e) => aplicarColorSelect(e.target)); // Aplicar al cambiar
});

// 4. GUARDAR INSPECCIÓN EN FIREBASE
document.getElementById('formChecklist').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnGuardar');
    btn.innerText = "Procesando..."; btn.disabled = true;

    const orden = document.getElementById('orden').value.trim().toUpperCase();

    try {
        // Verificar duplicidad
        const docRef = doc(db, "inspecciones25", orden);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            mostrarModal('warning', 'Orden Duplicada', `La Orden de Reparación ${orden} ya tiene una inspección registrada.`);
            btn.innerText = "💾 GUARDAR REPORTE DE INSPECCIÓN"; btn.disabled = false;
            return;
        }

        // Recopilar puntos
        let puntos = [];
        document.querySelectorAll('.punto-gral').forEach(select => {
            puntos.push({
                cat: select.getAttribute('data-cat'),
                nombre: select.getAttribute('data-nombre'),
                estado: select.value
            });
        });

        // Armar objeto
        const now = new Date();
        const data = {
            orden: orden,
            modelo: document.getElementById('modelo').value,
            fecha: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
            hora: now.toTimeString().substring(0, 5),
            timestamp: now.toISOString(),
            puntos: puntos,
            frenos: {
                di: document.getElementById('freno_del_izq').value, dd: document.getElementById('freno_del_der').value,
                ti: document.getElementById('freno_tra_izq').value, td: document.getElementById('freno_tra_der').value,
            },
            llantas: {
                di: document.getElementById('llanta_del_izq').value, dd: document.getElementById('llanta_del_der').value,
                ti: document.getElementById('llanta_tra_izq').value, td: document.getElementById('llanta_tra_der').value,
            },
            cierre: { comentarios: document.getElementById('comentarios').value.trim() }
        };

        // Guardar
        await setDoc(docRef, data);

        mostrarModal('success', '¡Inspección Guardada!', `El reporte para la orden ${orden} ha sido registrado exitosamente.`);

        // Limpiar formulario
        document.getElementById('formChecklist').reset();
        document.querySelectorAll('.semaforo-select').forEach(sel => aplicarColorSelect(sel));

    } catch (error) {
        console.error(error);
        mostrarModal('error', 'Error BD', 'No se pudo guardar la inspección. Revisa tu conexión.');
    } finally {
        btn.innerText = "💾 GUARDAR REPORTE DE INSPECCIÓN"; btn.disabled = false;
    }
});