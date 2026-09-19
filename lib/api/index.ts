import { Cuenta, Asiento } from "../types";

// ==========================================
// CAPA DE SERVICIOS - MOCKS PARA BACKEND
// ==========================================
// Nota para el equipo de Backend: 
// Reemplacen el contenido de estas promesas con sus llamadas reales (ej. axios.post('/api/asientos'))

const SIMULAR_LATENCIA = 800; // 800ms de retraso para simular la red

export const apiContabilidad = {
  
  // --- CATÁLOGO DE CUENTAS ---
  
  obtenerCatalogo: async (): Promise<Cuenta[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Aquí iría: const response = await fetch('/api/cuentas'); return response.json();
        console.log("📡 GET /api/cuentas - Fetched successfully");
        resolve([]); // Retornaría el catálogo real de la DB
      }, SIMULAR_LATENCIA);
    });
  },

  guardarCuenta: async (cuenta: Omit<Cuenta, 'id' | 'saldo'>): Promise<{ success: boolean, id: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Aquí iría: await axios.post('/api/cuentas', cuenta);
        console.log("📡 POST /api/cuentas - Payload:", cuenta);
        resolve({ success: true, id: Math.random().toString(36).substring(7) });
      }, SIMULAR_LATENCIA);
    });
  },

  // --- ASIENTOS Y LIBRO DIARIO ---

  guardarAsiento: async (asiento: Omit<Asiento, 'id' | 'cuadra'>): Promise<{ success: boolean, mensaje: string }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Validación de backend por seguridad (Nunca confiar solo en el frontend)
        const totalDebe = asiento.detalles.reduce((sum, det) => sum + det.debe, 0);
        const totalHaber = asiento.detalles.reduce((sum, det) => sum + det.haber, 0);
        
        if (Number(totalDebe.toFixed(2)) !== Number(totalHaber.toFixed(2))) {
          console.error("📡 POST /api/asientos - RECHAZADO: Partida doble inválida");
          reject(new Error("La partida doble no cuadra en el servidor."));
          return;
        }

        // Aquí iría: await axios.post('/api/asientos', asiento);
        console.log("📡 POST /api/asientos - Guardado con éxito en DB");
        resolve({ success: true, mensaje: "Asiento registrado en Base de Datos" });
      }, SIMULAR_LATENCIA);
    });
  },

  // --- CONFIGURACIÓN E IMPUESTOS ---

  obtenerConfiguracion: async (): Promise<any> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("📡 GET /api/configuracion");
        resolve({ iva: 13, retencion: 1, estadoPeriodo: 'Abierto' });
      }, SIMULAR_LATENCIA);
    });
  }
};