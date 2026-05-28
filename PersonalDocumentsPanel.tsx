import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Upload, Trash2 } from 'lucide-react';

export default function PersonalDocumentsPanel() {
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    fetchDocs();
  }, []);

  async function fetchDocs() {
    const { data } = await supabase.from('user_documents').select('*');
    if (data) setDocs(data);
  }

  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-slate-800">Documentos Personales</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Upload size={16} /> Subir Documento
        </button>
      </div>

      <div className="space-y-3">
        {docs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-500" />
              <span className="text-sm font-medium">{doc.title}</span>
            </div>
            <button className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}