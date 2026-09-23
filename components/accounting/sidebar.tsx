"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Settings,
  LayoutGrid,
  List,
  BookText,
  BookMarked,
  LineChart,
  Calculator,
  Archive,
  Scale,
} from 'lucide-react';

// El recorrido sigue el ciclo contable: se registra, se mayoriza, se
// comprueba, se valúa el inventario y se informa.
const navItems = [
  { name: 'Configuración', path: '/configuracion', icon: Settings },
  { name: 'Resumen', path: '/', icon: LayoutGrid },
  { name: 'Catálogo', path: '/catalogo', icon: List },
  { name: 'Libro Diario', path: '/asientos', icon: BookText },
  { name: 'Mayor', path: '/mayorizacion', icon: BookMarked },
  { name: 'Bal. Comprobación', path: '/comprobacion', icon: Scale },
  { name: 'Kardex', path: '/kardex', icon: Archive },
  { name: 'Liquidación IVA', path: '/liquidacion-iva', icon: Calculator },
  { name: 'Estados Financieros', path: '/reportes', icon: LineChart },
];

export function Sidebar() {
  const pathname = usePathname();
  
  return (
    <aside className="w-56 bg-zinc-50 border-r border-zinc-200 min-h-screen flex flex-col font-sans shrink-0">
      <div className="h-14 flex items-center px-6 font-semibold text-zinc-900 text-sm tracking-tight border-b border-zinc-200">
        Sistema Contable
      </div>
      
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-sm text-xs font-medium transition-colors ${
                isActive 
                  ? 'bg-black text-white' 
                  : 'text-zinc-600 hover:bg-zinc-200 hover:text-black'
              }`}
            >
              <item.icon size={14} strokeWidth={isActive ? 2.5 : 2} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-200">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-zinc-200 cursor-pointer transition-colors">
          <div className="w-6 h-6 rounded-sm bg-zinc-300 flex items-center justify-center text-[10px] font-bold text-zinc-700">
            AD
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-zinc-900">Admin</span>
            <span className="text-[10px] text-zinc-500">Finanzas</span>
          </div>
        </div>
      </div>
    </aside>
  );
}