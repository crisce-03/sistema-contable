// components/layout/Sidebar.tsx
import Link from 'next/link';

export function Sidebar() {
  const menuItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Catálogo de Cuentas', path: '/catalogo' },
    { name: 'Libro Diario (Asientos)', path: '/asientos' },
    { name: 'Mayorización y Kardex', path: '/mayorizacion' },
    { name: 'Estados Financieros', path: '/reportes' },
    { name: 'Configuración e IVA', path: '/configuracion' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-4 flex flex-col">
      <h2 className="text-2xl font-bold mb-8 text-center border-b border-slate-700 pb-4">
        Contabilidad
      </h2>
      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => (
          <Link 
            key={item.path} 
            href={item.path}
            className="p-3 rounded hover:bg-slate-800 transition-colors"
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}