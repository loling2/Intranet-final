import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Upload, User, Loader2, Trash2 } from 'lucide-react';
import { uploadToWasabi, deleteFromWasabi } from '../lib/wasabi'; 

export default function PersonalDocumentsPanel() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<any>(null);
  const [contenido, setContenido] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    supabase.from('empleados').select('id, nombre, dni').then(({ data }) => {
      if (data) setEmpleados(data);
    });
  }, []);

  async function fetchContenido() {
    if (!empleadoSeleccionado) return;
    setCargando(true);
    
    // Consultamos la tabla que creamos en el SQL Editor
    const { data, error } = await supabase
      .from('personal_documents') 
      .select('*')
      .eq('empleado_id', empleadoSeleccionado.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error al cargar:", error);
    } else {
      console.log("Documentos cargados:", data);
      setContenido(data || []);
    }
    setCargando(false);
  }

  useEffect(() => {
    fetchContenido();
  }, [empleadoSeleccionado]);

  const handleSubir = async (e: any) => {
    const file = e.target.files[0];
    if (!file || !empleadoSeleccionado) return;

    setCargando(true);
    try {
      const key = `rrhh/documentos_personal/${empleadoSeleccionado.dni}-${empleadoSeleccionado.nombre}/${Date.now()}-${file.name}`;
      
      // 1. Subir a Wasabi
      await uploadToWasabi(file, key);
      
      // 2. Registrar en base de datos
      const { error } = await supabase.from('personal_documents').insert({
        empleado_id: empleadoSeleccionado.id,
        nombre_archivo: file.name,
        wasabi_key: key,
        tipo: file.type,
        tamano_bytes: file.size
      });

      if (error) throw error;
      
      await fetchContenido();
    } catch (err: any) {
      console.error("Error completo:", err);
      alert("Error al subir archivo: " + err.message);
    } finally {
      setCargando(false);
      e.target.value = '';
    }
  };

  const handleEliminar = async (doc: any) => {
    if (!confirm("¿Estás seguro de eliminar este archivo permanentemente?")) return;

    try {
      setCargando(true);
      // 1. Borrar de Wasabi
      await deleteFromWasabi(doc.wasabi_key);
      
      // 2. Borrar de la base de datos
      const { error } = await supabase.from('personal_documents').delete().eq('id', doc.id);
      
      if (error) throw error;
      
      await fetchContenido();
    } catch (err) {
      console.error("Error al eliminar:", err);
      alert("Error al intentar borrar el archivo");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex h-[700px] gap-6 p-6 bg-white rounded-xl border border-slate-200">
      {/* Listado de empleados igual que tenías */}
      <div className="w-1/3 border-r pr-6 space-y-4">
        <input placeholder="Buscar trabajador..." className="w-full p-2 border rounded-lg" onChange={(e) => setBusqueda(e.target.value)} />
        <div className="overflow-y-auto h-[600px]">
          {empleados.filter(e => e.nombre?.toLowerCase().includes(busqueda.toLowerCase())).map(emp => (
            <button key={emp.id} onClick={() => setEmpleadoSeleccionado(emp)} className={`w-full text-left p-3 hover:bg-slate-50 rounded-lg flex items-center gap-3 border-b ${empleadoSeleccionado?.id === emp.id ? 'bg-blue-50' : ''}`}>
              <User size={18} className="text-slate-400" /> 
              <div className="text-sm"><p className="font-medium">{emp.nombre}</p><p className="text-xs text-slate-400">{emp.dni}</p></div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-2/3">
        {empleadoSeleccionado ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold">{empleadoSeleccionado.nombre}</h3>
              <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700">
                {cargando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Subir archivo
                <input type="file" className="hidden" onChange={handleSubir} disabled={cargando} />
              </label>
            </div>
            
            <div className="space-y-2">
              {contenido.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-100">
                  <div className="flex items-center gap-3">
                    <FileText className="text-blue-500" size={18} />
                    <span className="text-sm text-slate-700">{doc.nombre_archivo}</span>
                  </div>
                  <button onClick={() => handleEliminar(doc)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                    {cargando ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              ))}
              {!cargando && contenido.length === 0 && <p className="text-slate-400 text-sm">Esta carpeta está vacía.</p>}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">Selecciona un empleado para gestionar sus documentos</div>
        )}
      </div>
    </div>
  );
}