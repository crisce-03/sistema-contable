import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Cuenta, Asiento, DetalleAsiento } from '../types';

interface AccountingState {
  cuentas: Cuenta[];
  asientos: Asiento[];
  agregarCuenta: (cuenta: Omit<Cuenta, 'id' | 'saldo'>) => void;
  actualizarCuenta: (id: string, cuenta: Partial<Cuenta>) => void;
  agregarAsiento: (asiento: Omit<Asiento, 'id' | 'cuadra'>) => boolean;
  mayorizar: () => void;
}

export const useAccountingStore = create<AccountingState>((set, get) => ({
  cuentas: [
    { id: '1', codigo: '11010101', nombre: 'Caja General', tipo: 'Activo', saldo: 0, naturaleza: 'Deudora' },
    { id: '2', codigo: '1101020101', nombre: 'Banco de América Central, S.A.', tipo: 'Activo', saldo: 0, naturaleza: 'Deudora' },
    { id: '3', codigo: '11020101', nombre: 'Cuentas por Cobrar Clientes', tipo: 'Activo', saldo: 0, naturaleza: 'Deudora' },
    { id: '4', codigo: '1105', nombre: 'Inventarios', tipo: 'Activo', saldo: 0, naturaleza: 'Deudora' },
    { id: '5', codigo: '110901', nombre: 'Crédito Fiscal - IVA (Compras Locales)', tipo: 'Activo', saldo: 0, naturaleza: 'Deudora' },
    { id: '6', codigo: '210201', nombre: 'Proveedores Nacionales', tipo: 'Pasivo', saldo: 0, naturaleza: 'Acreedora' },
    { id: '7', codigo: '210403', nombre: 'Retención de Impuesto Sobre la Renta', tipo: 'Pasivo', saldo: 0, naturaleza: 'Acreedora' },
    { id: '8', codigo: '21080102', nombre: 'IVA - Débito Fiscal (CCF)', tipo: 'Pasivo', saldo: 0, naturaleza: 'Acreedora' },
    { id: '9', codigo: '310101', nombre: 'Capital Social Mínimo', tipo: 'Patrimonio', saldo: 0, naturaleza: 'Acreedora' },
    { id: '10', codigo: '4101', nombre: 'Costo de Ventas', tipo: 'Resultado Deudora', saldo: 0, naturaleza: 'Deudora' },
    { id: '11', codigo: '4102', nombre: 'Gastos Administrativos', tipo: 'Resultado Deudora', saldo: 0, naturaleza: 'Deudora' },
    { id: '12', codigo: '4103', nombre: 'Gastos de Venta', tipo: 'Resultado Deudora', saldo: 0, naturaleza: 'Deudora' },
    { id: '13', codigo: '51010101', nombre: 'Ventas a Contribuyentes', tipo: 'Resultado Acreedora', saldo: 0, naturaleza: 'Acreedora' },
    { id: '14', codigo: '51010402', nombre: 'Devoluciones sobre ventas', tipo: 'Resultado Deudora', saldo: 0, naturaleza: 'Deudora' },
    { id: '15', codigo: '610101', nombre: 'Pérdidas y ganancias', tipo: 'Cierre', saldo: 0, naturaleza: 'Acreedora' },
  ],
  asientos: [],

  agregarCuenta: (cuenta) => set((state) => ({ cuentas: [...state.cuentas, { ...cuenta, id: uuidv4(), saldo: 0 }] })),
  actualizarCuenta: (id, cuentaActualizada) => set((state) => ({ cuentas: state.cuentas.map((c) => c.id === id ? { ...c, ...cuentaActualizada } : c) })),
  
  agregarAsiento: (asientoBase) => {
    const totalDebe = asientoBase.detalles.reduce((sum, det) => sum + (Number(det.debe) || 0), 0);
    const totalHaber = asientoBase.detalles.reduce((sum, det) => sum + (Number(det.haber) || 0), 0);
    const cuadra = Number(totalDebe.toFixed(2)) === Number(totalHaber.toFixed(2));

    if (!cuadra) return false;

    const nuevoAsiento: Asiento = {
      ...asientoBase,
      id: uuidv4(),
      cuadra: true,
      detalles: asientoBase.detalles.map(d => ({ ...d, id: uuidv4() }))
    };

    set((state) => ({ asientos: [...state.asientos, nuevoAsiento] }));
    get().mayorizar();
    return true;
  },

  mayorizar: () => set((state) => {
    const cuentasActualizadas = state.cuentas.map((cuenta) => {
      let totalDebe = 0;
      let totalHaber = 0;

      state.asientos.forEach((asiento) => {
        asiento.detalles.forEach((detalle) => {
          if (detalle.codigoCuenta === cuenta.codigo) {
            totalDebe += Number(detalle.debe) || 0;
            totalHaber += Number(detalle.haber) || 0;
          }
        });
      });

      let nuevoSaldo = cuenta.naturaleza === 'Deudora' 
        ? totalDebe - totalHaber 
        : totalHaber - totalDebe;

      return { ...cuenta, saldo: nuevoSaldo };
    });
    return { cuentas: cuentasActualizadas };
  })
}));