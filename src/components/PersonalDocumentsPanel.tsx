import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Upload, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { uploadToWasabi, deleteFromWasabi } from '../lib/wasabi';

export default function PersonalDocumentsPanel() {
  const [docs, setDocs] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  async function fetchDocs() {
    setCargando(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('personal_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setDocs(data || []);
    } catch (err: any) {
      console.error("Error al cargar documentos:", err);
      setError("No se pudieron cargar los documentos.");
    } finally {
      setCargando(false);
    }
  }

  const handleSubir = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setCargando(true);
    try {
      // Definimos la ruta en Wasabi
      const key = `documentos_personales/${Date.now()}-${file.name}`;
      
      // 1. Subir el archivo a Wasabi
      await uploadToWasabi(file, key);
      
      // 2. Insertar metadatos en Supabase
      const { error: insertError } = await supabase.from('personal_documents').insert({
        nombre_archivo: file.name,
        wasabi_key: key,
        tipo: file.type,
        tamano_bytes: file.size
      });

      if (insertError) throw insertError;
      
      // Recargar lista
      await fetchDocs();
    } catch (err: any) {
      console.error("Error al subir:", err);
      alert("Error al subir: " + (err.message || "Inténtalo de nuevo"));
    } finally {
      setCargando(false);
      e.target.value = ''; // Limpiar el input
    }
  };

  const handleEliminar = async (doc: any) => {
    if (!confirm(`¿Borrar permanentemente "${doc.nombre_archivo}"?`)) return;

    setCargando(true);
    try {
      // 1. Borrar de Wasabi
      await deleteFromWasabi(doc.wasabi_key);
      
      // 2. Borrar de Supabase
      const { error: deleteError } = await supabase.from('personal_documents').delete().eq('id', doc.id);
      
      if (deleteError) throw deleteError;
      
      await fetchDocs();
    } catch (err) {
      console.error("Error al borrar:", err);
      alert("Error al intentar borrar el archivo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-slate-800">Documentos Personales</h2>
        
        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer transition-colors">
          {cargando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          <span>{cargando ? "Subiendo..." : "Subir Documento"}</span>
          <input type="file" className="hidden" onChange={handleSubir} disabled={cargando} />
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 text-red-600 bg-red-50 rounded-lg text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="space-y-3">
        {cargando && docs.length === 0 ? (
          <p className="text-slate-400 text-sm italic">Cargando documentos...</p>
        ) : docs.length === 0 ? (
          <p className="text-slate-400 text-sm">No hay documentos subidos actualmente.</p>
        ) : (
          docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-500" size={20} />
                <span className="text-sm font-medium text-slate-700">{doc.nombre_archivo}</span>
              </div>
              <button 
                onClick={() => handleEliminar(doc)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                disabled={cargando}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}