"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: 'SuperAdmin' | 'Contador' | 'Auxiliar' | 'Auditor';
  estado: 'Activo' | 'Inactivo';
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([
    { id: '1', nombre: 'Administrador Sistema', correo: 'admin@empresa.com', rol: 'SuperAdmin', estado: 'Activo' },
    { id: '2', nombre: 'Contador General', correo: 'contador@empresa.com', rol: 'Contador', estado: 'Activo' },
    { id: '3', nombre: 'Auxiliar Operativo', correo: 'auxiliar@empresa.com', rol: 'Auxiliar', estado: 'Inactivo' },
  ]);

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState<Usuario['rol']>('Auxiliar');
  const [estado, setEstado] = useState<Usuario['estado']>('Activo');

  const handleCrearUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !correo) return;

    setUsuarios([...usuarios, { id: Math.random().toString(36).substring(7), nombre, correo, rol, estado }]);
    setNombre(""); setCorreo(""); setRol("Auxiliar"); setEstado("Activo");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios y Roles</h1>
        <p className="text-sm text-zinc-500 mt-1">Control estricto de accesos y permisos operativos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Panel Formulario */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCrearUsuario} className="space-y-4 bg-zinc-50 p-4 border border-zinc-200">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Registrar Usuario</h2>
            
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required />
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Correo electrónico" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required />
            
            <select value={rol} onChange={(e) => setRol(e.target.value as Usuario['rol'])} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
              <option value="SuperAdmin">SuperAdmin</option>
              <option value="Contador">Contador</option>
              <option value="Auxiliar">Auxiliar</option>
              <option value="Auditor">Auditor</option>
            </select>

            <select value={estado} onChange={(e) => setEstado(e.target.value as Usuario['estado'])} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>

            <button type="submit" className="w-full flex items-center justify-center gap-2 py-2 bg-black text-white text-sm rounded-sm hover:bg-zinc-800 transition-colors">
              <Plus size={14} /> Otorgar Acceso
            </button>
          </form>
        </div>

        {/* Tabla de Usuarios */}
        <div className="lg:col-span-3">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-zinc-900 text-xs uppercase text-zinc-500 tracking-wider">
                <th className="py-3 font-medium">Identidad</th>
                <th className="py-3 font-medium">Credencial</th>
                <th className="py-3 font-medium">Nivel de Acceso</th>
                <th className="py-3 font-medium text-center">Estado</th>
                <th className="py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="group hover:bg-zinc-50 transition-colors">
                  <td className="py-3 font-medium">{usuario.nombre}</td>
                  <td className="py-3 text-zinc-500">{usuario.correo}</td>
                  <td className="py-3">
                    <span className="border border-zinc-300 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-sm text-zinc-700">
                      {usuario.rol}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${usuario.estado === 'Activo' ? 'text-black' : 'text-zinc-400'}`}>
                      {usuario.estado}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <button 
                      onClick={() => setUsuarios(usuarios.filter(u => u.id !== usuario.id))}
                      className="text-zinc-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}