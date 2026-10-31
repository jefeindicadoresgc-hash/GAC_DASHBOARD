import { db, collection, getDocs, query, limit } from './firebase-config.js';

export async function cargarAgendaLateral() {
    const panel = document.getElementById('listaCitasPanel');
    const indicador = document.getElementById('indicadorProximoDia');
    
    try {
        const q = query(collection(db, "citas"), limit(50)); 
        const snapshot = await getDocs(q);
        
        // 1. OBTENER HORA LOCAL EXACTA (Adiós error de UTC)
        const ahora = new Date();
        const yyyy = ahora.getFullYear();
        const mm = String(ahora.getMonth() + 1).padStart(2, '0');
        const dd = String(ahora.getDate()).padStart(2, '0');
        const hoyStr = `${yyyy}-${mm}-${dd}`;
        const horaAct = ahora.toTimeString().substring(0, 5);
        
        // 2. Calcular próximo día laboral
        let proxDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        if (proxDia.getDay() === 5) proxDia.setDate(proxDia.getDate() + 3); // Viernes a Lunes
        else if (proxDia.getDay() === 6) proxDia.setDate(proxDia.getDate() + 2); // Sábado a Lunes
        else proxDia.setDate(proxDia.getDate() + 1); // Dom-Jueves a Mañana
        
        const pyyyy = proxDia.getFullYear();
        const pmm = String(proxDia.getMonth() + 1).padStart(2, '0');
        const pdd = String(proxDia.getDate()).padStart(2, '0');
        const proxDiaStr = `${pyyyy}-${pmm}-${pdd}`;
        
        const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const nombreProxDia = diasNombres[proxDia.getDay()];

        panel.innerHTML = '';
        let citasValidas = 0;
        let citasProximoDia = 0;

        const citasArray = [];
        snapshot.forEach(doc => citasArray.push(doc.data()));
        citasArray.sort((a,b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

        citasArray.forEach(data => {
            if (data.fecha === proxDiaStr) citasProximoDia++;
            // Ocultar si el día ya pasó o la hora ya pasó hoy
            if (data.fecha < hoyStr || (data.fecha === hoyStr && data.hora < horaAct)) return;

            citasValidas++;
            const colorMarca = data.marca === 'GWM' ? '#0066CC' : '#FF3B30';
            const precioTxt = data.precioServicio > 0 ? `$${data.precioServicio.toLocaleString('es-MX')}` : 'Cotizar';
            
            panel.innerHTML += `
                <div class="cita-card">
                    <strong style="color:${colorMarca}">${data.marca} - ${data.hora}</strong>
                    <span><strong>Día:</strong> ${data.fecha}</span><br>
                    <span><strong>Mod:</strong> ${data.modelo}</span><br>
                    <span><strong>Mantenimiento:</strong> ${data.kilometraje.toLocaleString()} km</span><br>
                    <span><strong>Costo:</strong> ${precioTxt}</span>
                </div>
            `;
        });

        indicador.innerHTML = `<div class="indicador-laboral">Citas para el ${nombreProxDia} (Próximo día): ${citasProximoDia}</div>`;
        if (citasValidas === 0) panel.innerHTML = '<p style="font-size:13px; color:gray;">Sin citas activas en agenda.</p>';
        
    } catch (error) {
        console.error("Error BD:", error);
    }
}