import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, Briefcase } from 'lucide-react';
import { CRM_PANEL_PESTANAS, CRM_FICHA_PESTANAS } from '../lib/crmPestanas';

interface PerfilRow {
  id: string;
  puesto_tags: { nombre: string } | null;
  crm_perfil_pestanas: { pestana: string; activo: boolean }[];
}

interface Perfil {
  id: string;
  nombre: string;
  activas: Set<string>;
}

export default function CrmPermisosModule() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('crm_perfiles')
      .select('id, puesto_tags(nombre), crm_perfil_pestanas(pestana, activo)');
    if (err) { setError('No se pudieron cargar los perfiles.'); setLoading(false); return; }
    const lista = ((data ?? []) as unknown as PerfilRow[]).map((p) => ({
      id: p.id,
      nombre: p.puesto_tags?.nombre ?? 'Sin nombre',
      activas: new Set(p.crm_perfil_pestanas.filter((f) => f.activo).map((f) => f.pestana)),
    })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    setPerfiles(lista);
    setSelectedId((prev) => prev ?? lista[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = perfiles.find((p) => p.id === selectedId) ?? null;

  const togglePestana = async (key: string) => {
    if (!selected) return;
    const nuevoValor = !selected.activas.has(key);
    setSavingKey(key); setError('');
    const { error: err } = await supabase.from('crm_perfil_pestanas').upsert(
      { perfil_id: selected.id, pestana: key, activo: nuevoValor, updated_at: new Date().toISOString() },
      { onConflict: 'perfil_id,pestana' },
    );
    if (err) setError('No se pudo guardar el cambio. Inténtalo de nuevo.');
    else {
      setPerfiles((prev) => prev.map((p) => {
        if (p.id !== selected.id) return p;
        const activas = new Set(p.activas);
        if (nuevoValor) activas.add(key); else activas.delete(key);
        return { ...p, activas };
      }));
    }
    setSavingKey(null);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} />
        <p className="text-sm" style={{ color: '#64748B' }}>Cargando perfiles...</p>
      </div>
    );
  }

  if (perfiles.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <Briefcase size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
        <p className="text-sm font-medium" style={{ color: '#475569' }}>No hay puestos de trabajo</p>
        {error && <p className="text-xs mt-2" style={{ color: '#DC2626' }}>{error}</p>}
      </div>
    );
  }

  const seccion = (titulo: string, items: { key: string; label: string }[]) => (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>{titulo}</h4>
      <div className="rounded-xl divide-y" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {items.map((item) => {
          const activa = selected?.activas.has(item.key) ?? false;
          const guardando = savingKey === item.key;
          return (
            <div key={item.key} className="flex items-center justify-between px-4 py-3" style={{ borderColor: '#F1F5F9' }}>
              <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{item.label}</span>
              <button role="switch" aria-checked={activa} onClick={() => togglePestana(item.key)} disabled={guardando}
                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: activa ? '#0369A1' : '#CBD5E1' }}>
                <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: activa ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Permisos por puesto</h2>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Elige un puesto y activa las pestañas que verán sus profesionales. Admin y RRHH siempre ven todo.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {perfiles.map((p) => {
          const sel = p.id === selectedId;
          return (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
              style={{ backgroundColor: sel ? '#0369A1' : '#FFFFFF', color: sel ? '#FFFFFF' : '#475569', border: `1px solid ${sel ? '#0369A1' : '#E2E8F0'}` }}>
              {p.nombre}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {seccion('Panel CRM', CRM_PANEL_PESTANAS)}
          {seccion('Ficha de residente', CRM_FICHA_PESTANAS)}
        </div>
      )}
    </div>
  );
}
