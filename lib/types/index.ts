export interface Cuenta {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  tipo: string;
  naturaleza: "Deudora" | "Acreedora";
  rubro: string;
  padreCodigo: string | null;
  activa: boolean;
  movimiento: boolean;
  saldo: number;
  debe: number;
  haber: number;
}
export interface DetalleAsiento {
  id: string;
  cuentaId: string;
  codigoCuenta: string;
  parcial: number;
  debe: number;
  haber: number;
  descripcion?: string;
}
export interface Asiento {
  id: string;
  referencia: string;
  numero: number;
  fecha: string;
  concepto: string;
  tipo: "normal" | "ajuste" | "reversion";
  reversaDe?: string | null;
  modoIva?: ModoIva;
  ajusteInventario?: "inicial" | "final" | null;
  detalles: DetalleAsiento[];
  cuadra: boolean;
  liquidacionIva?: string;
}
export interface Periodo {
  anio: number;
  cerrado: boolean;
}
export interface CuentaInput {
  codigo: string;
  nombre: string;
  familia: string;
  padreCodigo: string | null;
  activa: boolean;
}
export interface AsientoInput {
  modoIva?: ModoIva;
  ajusteInventario?: "inicial" | "final" | null;
  referencia: string;
  fecha: string;
  concepto: string;
  tipo: "normal" | "ajuste";
  detalles: {
    codigoCuenta: string;
    debe: string;
    haber: string;
    descripcion?: string;
  }[];
}

export type ModoIva = "mas_iva" | "incluido";
export type ModoInventario = "traslados_compras" | "inventarios_explicitos";
export interface ConfiguracionLibro {
  modoIva: ModoIva;
  modoInventario: ModoInventario;
  cuentaIvaCredito?: string;
  cuentaIvaDebito?: string;
}
export interface LibroLocal {
  versionLocal: 2 | 3;
  cuentas: Cuenta[];
  asientos: Asiento[];
  periodos: Periodo[];
  configuracion: ConfiguracionLibro;
  kardex?: KardexProducto[];
}

export interface KardexProducto {
  id: string;
  nombre: string;
  costo: string;
  venta: string;
  inicio: string;
  fin: string;
  inicial: number;
  cuentas: Record<
    "compras" | "ventas" | "devolCompras" | "devolVentas",
    string
  >;
}