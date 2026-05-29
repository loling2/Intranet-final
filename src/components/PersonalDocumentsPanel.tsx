import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Upload, ChevronLeft, User, Loader2 } from 'lucide-react';
import { uploadToWasabi } from '../lib/wasabi'; 

export default function PersonalDocumentsPanel() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<any>(null);
  const [rutaActual, setRutaActual] = useState('rrhh/documentos personal/');
  const [contenido, setContenido] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    supabase.from('empleados').select('id, nombre, dni').then(({ data }) => {
      if (data) setEmpleados(data);
    });
  }, []);

  useEffect(() => {
    if (empleadoSeleccionado) {
      fetchContenido();
    }
  }, [rutaActual, empleadoSeleccionado]);

  async function fetchContenido() {
    setCargando(true);
    try {
      const { data, error } = await supabase.functions.invoke('listar-archivos-wasabi', {
        body: { prefix: rutaActual }
      });
      
      if (error) throw error;
      setContenido(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al listar:", err);
      setContenido([]);
    } finally {
      setCargando(false);
    }
  }

  const handleSubir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando(true);
    try {
      const fullPath = `${rutaActual}${file.name}`;
      await uploadToWasabi(file, fullPath);
      
      // Espera para asegurar consistencia en S3 antes de refrescar
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Refresco explícito
      await fetchContenido(); 
    } catch (err: any) {
      console.error(err);
      alert(`Error al subir: ${err.message || 'Error desconocido'}`);
    } finally {
      setCargando(false);
      // Limpiar input para permitir subidas consecutivas
      e.target.value = '';
    }
  };

  const irAtras = () => {
    const partes = rutaActual.split('/').filter(Boolean);
    if (partes.length > 2) {
      partes.pop();
      setRutaActual(partes.join('/') + '/');
    }
  };

  return (
    <div className="flex h-[700px] gap-6 p-6 bg-white rounded-xl border border-slate-200">
      <div className="w-1/3 border-r pr-6 space-y-4">
        <input 
          placeholder="Buscar trabajador..."
          className="w-full p-2 border rounded-lg"
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="overflow-y-auto h-[600px]">
          {empleados.filter(e => e.nombre?.toLowerCase().includes(busqueda.toLowerCase())).map(emp => (
            <button 
              key={emp.id}
              onClick={() => {
                setEmpleadoSeleccionado(emp);
                setRutaActual(`rrhh/documentos personal/${emp.dni}-${emp.nombre}/`);
              }}
              className={`w-full text-left p-3 hover:bg-slate-50 rounded-lg flex items-center gap-3 border-b ${empleadoSeleccionado?.id === emp.id ? 'bg-blue-50' : ''}`}
            >
              <User size={18} className="text-slate-400" /> 
              <div className="text-sm">
                <p className="font-medium">{emp.nombre}</p>
                <p className="text-xs text-slate-400">{emp.dni}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-2/3">
        {empleadoSeleccionado ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <button onClick={irAtras} className="flex items-center text-blue-600 hover:underline">
                <ChevronLeft size={16}/> Volver atrás
              </button>
              <label className={`cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${cargando ? 'opacity-50' : 'hover:bg-blue-700'}`}>
                {cargando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {cargando ? "Subiendo..." : "Subir archivo"}
                <input type="file" className="hidden" onChange={handleSubir} disabled={cargando} />
              </label>
            </div>
            
            <div className="space-y-2">
              {contenido.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-100">
                  <div className="flex items-center gap-3 w-full">
                    <FileText className="text-blue-500" />
                    <span className="text-sm text-slate-700">{item.name || item}</span>
                  </div>
                </div>
              ))}
              {!cargando && contenido.length === 0 && <p className="text-slate-400 text-sm">Esta carpeta está vacía.</p>}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            Selecciona un empleado para ver sus documentos
          </div>
        )}
      </div>
    </div>
  );
}