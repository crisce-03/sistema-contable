export interface Cuenta {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'Activo' | 'Pasivo' | 'Patrimonio' | 'Resultado Deudora' | 'Resultado Acreedora' | 'Cierre';
  saldo: number;
  naturaleza: 'Deudora' | 'Acreedora';
}

export interface DetalleAsiento {
  id: string;
  cuentaId: string;
  codigoCuenta: string;
  parcial: number; // Montos de subcuentas o valores sin IVA
  debe: number;
  haber: number;
}

export interface Asiento {
  id: string;
  fecha: string;
  concepto: string;
  detalles: DetalleAsiento[];
  cuadra: boolean;
}