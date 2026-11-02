// js/pdf_service.js

export async function generarPDFResultados(cita, tecnicoData) {
    // 1. Crear un contenedor temporal para el PDF
    const pdfContenedor = document.createElement('div');
    pdfContenedor.style.padding = '40px';
    pdfContenedor.style.background = 'white';
    pdfContenedor.style.fontFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    pdfContenedor.style.color = '#333';
    pdfContenedor.style.width = '800px'; // Forzar ancho para el render

    // 2. Construir fecha formato largo
    const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric' };
    const fechaImpresion = new Date().toLocaleDateString('es-MX', opcionesFecha);

    // 3. Evaluar resultados del técnico
    let tablaMultipuntos = '';
    if (tecnicoData && tecnicoData.puntos && tecnicoData.puntos.length > 0) {
        tablaMultipuntos = `
            <h3 style="color:#1e293b; font-size:14px; border-bottom:2px solid #cbd5e1; padding-bottom:5px; margin-top:25px;">INSPECCIÓN DE PUNTOS DE SEGURIDAD</h3>
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:10px;">
                <tr style="background:#f1f5f9; color:#475569; text-align:left;">
                    <th style="padding:8px; border:1px solid #e2e8f0;">Sistema</th>
                    <th style="padding:8px; border:1px solid #e2e8f0;">Elemento</th>
                    <th style="padding:8px; border:1px solid #e2e8f0;">Condición</th>
                </tr>
        `;
        tecnicoData.puntos.forEach(p => {
            // Estilos sobrios sin emojis para el cliente
            let color = p.estado === 'Verde' ? '#15803d' : p.estado === 'Amarillo' ? '#b45309' : p.estado === 'Rojo' ? '#b91c1c' : '#64748b';
            let texto = p.estado === 'Verde' ? 'Óptimo' : p.estado === 'Amarillo' ? 'Requiere Atención' : p.estado === 'Rojo' ? 'Daño / Urgente' : 'N/A';

            tablaMultipuntos += `
                <tr>
                    <td style="padding:8px; border:1px solid #e2e8f0; color:#475569;">${p.cat}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0; font-weight:bold;">${p.nombre}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0; color:${color}; font-weight:bold;">${texto}</td>
                </tr>
            `;
        });
        tablaMultipuntos += `</table>`;

        // Añadir Llantas y Frenos en diseño limpio
        if (tecnicoData.llantas || tecnicoData.frenos) {
            tablaMultipuntos += `
                <div style="display:flex; gap:20px; margin-top:20px; font-size:12px;">
                    <div style="flex:1; background:#f8fafc; padding:15px; border:1px solid #e2e8f0; border-radius:6px;">
                        <strong style="color:#0f172a;">Presión Llantas (PSI):</strong><br>
                        Del. Izq: ${tecnicoData.llantas.di || '-'} | Del. Der: ${tecnicoData.llantas.dd || '-'}<br>
                        Tra. Izq: ${tecnicoData.llantas.ti || '-'} | Tra. Der: ${tecnicoData.llantas.td || '-'}
                    </div>
                    <div style="flex:1; background:#f8fafc; padding:15px; border:1px solid #e2e8f0; border-radius:6px;">
                        <strong style="color:#0f172a;">Desgaste Frenos (mm):</strong><br>
                        Del. Izq: ${tecnicoData.frenos.di || '-'} | Del. Der: ${tecnicoData.frenos.dd || '-'}<br>
                        Tra. Izq: ${tecnicoData.frenos.ti || '-'} | Tra. Der: ${tecnicoData.frenos.td || '-'}
                    </div>
                </div>
            `;
        }
    }

    let reportesAdicionales = '';
    if (tecnicoData && tecnicoData.causaFallo) {
        reportesAdicionales += `
            <div style="margin-top:20px; border-left:4px solid #ef4444; padding-left:15px; background:#fef2f2; padding:15px;">
                <strong style="color:#991b1b; font-size:13px;">DICTAMEN DE DIAGNÓSTICO:</strong>
                <p style="margin:5px 0; font-size:12px; color:#333;"><strong>Causa encontrada:</strong> ${tecnicoData.causaFallo}</p>
                <p style="margin:0; font-size:12px; color:#333;"><strong>Solución:</strong> ${tecnicoData.remedioFallo}</p>
            </div>
        `;
    }

    // 4. Inyectar todo el HTML al contenedor
    pdfContenedor.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #0f172a; padding-bottom:15px; margin-bottom:25px;">
            <div>
                <h1 style="margin:0; color:#0f172a; font-size:24px; letter-spacing:1px; text-transform:uppercase;">REPORTE DE SERVICIO</h1>
                <p style="margin:5px 0 0; font-size:12px; color:#64748b; font-weight:bold;">${cita.marca} COATZACOALCOS</p>
            </div>
            <div style="text-align:right; font-size:12px; color:#475569;">
                <strong>Fecha:</strong> ${fechaImpresion}<br>
                <strong>Folio / Placas:</strong> ${cita.placas || 'S/P'}
            </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px; margin-bottom:20px; display:flex; justify-content:space-between; font-size:13px;">
            <div>
                <p style="margin:0 0 5px; color:#64748b;">Cliente</p>
                <p style="margin:0; font-weight:bold; color:#0f172a; font-size:15px;">${cita.nombreCliente}</p>
            </div>
            <div style="text-align:right;">
                <p style="margin:0 0 5px; color:#64748b;">Vehículo</p>
                <p style="margin:0; font-weight:bold; color:#0f172a;">${cita.modelo}</p>
                <p style="margin:2px 0 0; color:#475569; font-size:11px;">VIN: ${cita.vin}</p>
            </div>
        </div>

        ${tablaMultipuntos}
        ${reportesAdicionales}

        <div style="margin-top:30px;">
            <h3 style="color:#1e293b; font-size:14px; border-bottom:2px solid #cbd5e1; padding-bottom:5px;">COMENTARIOS DEL TALLER</h3>
            <p style="font-size:12px; line-height:1.6; color:#334155; background:#f8fafc; padding:15px; border:1px solid #e2e8f0; border-radius:6px; min-height:60px;">
                ${tecnicoData ? (tecnicoData.comentarios || 'Sin observaciones adicionales.') : 'Servicio concluido.'}
            </p>
        </div>
    `;

    // 5. Renderizar y eliminar
    document.body.appendChild(pdfContenedor);
    await html2pdf().set({
        margin: 0.5,
        filename: `Reporte_${cita.placas || cita.nombreCliente}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    }).from(pdfContenedor).save();

    document.body.removeChild(pdfContenedor);
}