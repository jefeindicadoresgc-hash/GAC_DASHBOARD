// js/login.js
document.getElementById('btnLogin').addEventListener('click', validarAcceso);

document.getElementById('loginCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        validarAcceso();
    }
});

function validarAcceso() {
    const code = document.getElementById('loginCode').value.toUpperCase().trim();
    const errorMsg = document.getElementById('errorMsg');

    // ==========================================
    // LOS 4 ACCESOS MAESTROS DEL SISTEMA
    // ==========================================

    // 1 y 2. ÁREA DE CITAS (BDC)
    if (code === "CITASGWM") {
        localStorage.setItem('dms_rol', 'CITAS');
        localStorage.setItem('dms_marca', 'GWM'); // Forzamos la marca
        window.location.href = 'dashboard_citas.html';
    }
    else if (code === "CITASGAC") {
        localStorage.setItem('dms_rol', 'CITAS');
        localStorage.setItem('dms_marca', 'GAC'); // Forzamos la marca
        window.location.href = 'dashboard_citas.html';
    }

    // 3. ÁREA DE ASESORES (Recepción de piso)
    else if (code === "ASESOR") {
        localStorage.setItem('dms_rol', 'ASESOR');
        window.location.href = 'dashboard_asesor.html';
    }

    // 4. ÁREA TÉCNICA (Bahía de Taller)
    else if (code === "TECNICO") {
        localStorage.setItem('dms_rol', 'TECNICO');
        window.location.href = 'dashboard_tecnico.html';
    }

    // Error
    else {
        errorMsg.style.display = 'block';
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 3000);
    }
}