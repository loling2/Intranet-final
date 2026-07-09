import { useState, useEffect } from 'react';
import { X, Hash, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Props {
  onClose: () => void;
}

export default function ChangePinModal({ onClose }: Props) {
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('user_profiles')
        .select('pin')
        .eq('id', user.id)
        .maybeSingle();
      setCurrentPin(data?.pin ?? null);
      setLoading(false);
    })();
  }, []);

  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  const handleSave = async () => {
    setError('');
    if (newPin.length !== 4) { setError('El PIN debe tener exactamente 4 digitos.'); return; }
    if (newPin !== confirmPin) { setError('Los PINs no coinciden.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No se pudo obtener el usuario.');
      const { error: err } = await supabase
        .from('user_profiles')
        .update({ pin: newPin })
        .eq('id', user.id);
      if (err) throw err;
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar el PIN.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <Hash size={15} className="text-white" />
            </div>
            <h2 className="text-white font-semibold text-sm">Cambiar PIN de Acceso</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : done ? (
            <div className="flex flex-col items-center py-4 text-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ECFDF5', border: '2px solid #6EE7B7' }}>
                <CheckCircle2 size={28} style={{ color: '#065F46' }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: '#065F46' }}>PIN actualizado</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Tu nuevo PIN esta activo desde ahora.</p>
              <button
                onClick={onClose}
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              {currentPin !== null && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                    PIN actual
                  </label>
                  <div className="relative">
                    <input
                      readOnly
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPin}
                      className="w-full px-4 pr-10 py-2.5 rounded-xl text-sm outline-none tracking-widest"
                      style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F1F5F9' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                      style={{ color: '#94A3B8' }}
                    >
                      {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}
              {currentPin === null && (
                <div className="px-3 py-2.5 rounded-xl text-xs" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', color: '#92400E' }}>
                  No tienes PIN asignado aun. Crea uno nuevo abajo.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Nuevo PIN (4 digitos)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={e => { setNewPin(onlyDigits(e.target.value)); setError(''); }}
                  placeholder="••••"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none tracking-widest text-center font-mono text-lg"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC', letterSpacing: '0.4em' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Confirmar nuevo PIN
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPin}
                  onChange={e => { setConfirmPin(onlyDigits(e.target.value)); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="••••"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none tracking-widest text-center font-mono text-lg"
                  style={{
                    border: `1.5px solid ${confirmPin && confirmPin !== newPin ? '#FECACA' : '#E2E8F0'}`,
                    color: '#1E293B',
                    backgroundColor: '#F8FAFC',
                    letterSpacing: '0.4em',
                  }}
                />
                {confirmPin && confirmPin !== newPin && (
                  <p className="text-xs mt-1" style={{ color: '#DC2626' }}>Los PINs no coinciden</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <AlertCircle size={13} style={{ color: '#DC2626' }} />
                  <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || newPin.length !== 4 || newPin !== confirmPin}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#0F172A' }}
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Hash size={14} />}
                  Guardar PIN
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
