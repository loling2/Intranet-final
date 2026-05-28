import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Upload, Trash2, Folder, ChevronLeft, Search, User } from 'lucide-react';

export default function PersonalDocumentsPanel() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<any>(null);
  const [rutaActual, setRutaActual] = useState('rrhh/documentos personal/');
  const [contenido, setContenido] = useState<any[]>([]); // Archivos y carpetas
  const [busqueda, setBusqueda] = useState('');

  // 1. Cargar empleados al inicio
  useEffect(() => {
    supabase.from('empleados').select('id, nombre, dni').then(({ data }) => {
      if (data) setEmpleados(data);
    });
  }, []);

  // 2. Cargar contenido de Wasabi cada vez que cambia la ruta
  useEffect(() => {
    if (empleadoSeleccionado) {
      fetchContenido();
    }
  }, [rutaActual, empleadoSeleccionado]);

  async function fetchContenido() {
    const { data } = await supabase.storage.from('documentacion').list(rutaActual);
    if (data) setContenido(data);
  }

  const handleSubir = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    await supabase.storage.from('documentacion').upload(`${rutaActual}${file.name}`, file);
    fetchContenido(); // Refrescar
  };

  const irAtras = () => {
    const partes = rutaActual.split('/').filter(Boolean);
    partes.pop();
    setRutaActual(partes.length > 1 ? partes.join('/') + '/' : 'rrhh/documentos personal/');
  };

  return (
    <div className="flex h-[700px] gap-6 p-6 bg-white rounded-xl border border-slate-200">
      {/* Columna Izquierda: Buscador de Empleados */}
      <div className="w-1/3 border-r pr-6 space-y-4">
        <input 
          placeholder="Buscar trabajador..."
          className="w-full p-2 border rounded-lg"
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {empleados.filter(e => e.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(emp => (
          <button 
            key={emp.id}
            onClick={() => {
              setEmpleadoSeleccionado(emp);
              setRutaActual(`rrhh/documentos personal/${emp.dni}-${emp.nombre}/`);
            }}
            className="w-full text-left p-3 hover:bg-slate-50 rounded-lg flex items-center gap-3"
          >
            <User size={18} /> {emp.nombre}
          </button>
        ))}
      </div>

      {/* Columna Derecha: Explorador de Archivos */}
      <div className="w-2/3">
        {empleadoSeleccionado ? (
          <>
            <div className="flex justify-between mb-4">
              <button onClick={irAtras} className="flex items-center text-blue-600"><ChevronLeft size={16}/> Atrás</button>
              <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                <Upload size={16} /> Subir archivo
                <input type="file" className="hidden" onChange={handleSubir} />
              </label>
            </div>
            
            <div className="space-y-2">
              {contenido.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                  <div 
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => item.id === null && setRutaActual(`${rutaActual}${item.name}/`)}
                  >
                    {item.id === null ? <Folder className="text-yellow-500" /> : <FileText className="text-blue-500" />}
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-slate-400">Selecciona un empleado</p>
        )}
      </div>
    </div>
  );
}