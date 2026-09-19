import { Plus } from "lucide-react";

export default function UsuariosPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <p
        role="status"
        className="border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600"
      >
        Diseño del módulo conservado. Su integración está pendiente; esta
        pantalla no calcula ni registra operaciones.
      </p>

      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Usuarios y Roles
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Control estricto de accesos y permisos operativos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <form className="space-y-4 bg-zinc-50 p-4 border border-zinc-200">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
              Registrar Usuario
            </h2>

            <input
              type="text"
              placeholder="Nombre completo"
              className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
              required
              disabled
            />
            <input
              type="email"
              placeholder="Correo electrónico"
              className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
              required
              disabled
            />

            <select
              className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
              disabled
            >
              <option>SuperAdmin</option>
              <option>Contador</option>
              <option>Auxiliar</option>
              <option>Auditor</option>
            </select>

            <select
              className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
              disabled
            >
              <option>Activo</option>
              <option>Inactivo</option>
            </select>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 bg-black text-white text-sm rounded-sm hover:bg-zinc-800 transition-colors"
              disabled
            >
              <Plus size={14} /> Otorgar Acceso
            </button>
          </form>
        </div>

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
              <tr>
                <td
                  colSpan={12}
                  className="p-8 text-center text-xs text-zinc-400"
                >
                  Integración pendiente. Sin operaciones disponibles.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
