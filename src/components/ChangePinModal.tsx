import { useState } from 'react';
import { X, Hash, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Props {
  onClose: () => void;
}

export default function ChangePinModal({ onClose }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handlePinInput = (val: string, setter: (v: string) => void) => {
    if (/^\d{0,6}$/.test(val)) {
      setter(val);
      setError('');
    }
  };

  const handleSave = async () => {
    setError('');
    if (pin.length < 4) { setError('El PIN debe tener al menos 4 digitos.'); return; }
    if (pin !== confirm) { setError('Los PINs no coinciden.'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No se pudo obtener el usuario.');

      // Check if PIN is already used by another active user
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('pin', pin)
        .eq('activo', true)
        .neq('id', user.id)
        .maybeSingle();

      if (existing) {
        setError('PIN no disponible. Este PIN ya está en uso por otro usuario activo. Utiliza uno diferente.');
        setSaving(false);
        return;
      }

      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update({ pin })
        .eq('id', user.id);

      if (updateErr) throw updateErr;
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
            <h2 className="text-white font-semibold text-sm">Cambiar PIN</h2>
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
          {done ? (
            <div className="flex flex-col items-center py-4 text-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ECFDF5', border: '2px solid #6EE7B7' }}>
                <CheckCircle2 size={28} style={{ color: '#065F46' }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: '#065F46' }}>PIN actualizado</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Tu nuevo PIN de acceso esta activo.</p>
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
              <p className="text-xs" style={{ color: '#64748B' }}>
                El PIN se usa para registrar entradas, salidas y vehiculos desde el quiosco. Debe tener entre 4 y 6 digitos.
              </p>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Nuevo PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => handlePinInput(e.target.value, setPin)}
                  placeholder="4-6 digitos"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none tracking-[0.4em] text-center font-mono"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC', letterSpacing: pin ? '0.4em' : undefined }}
                />
                {pin.length > 0 && (
                  <div className="flex gap-1 mt-2 justify-center">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-full transition-all duration-200"
                        style={{ backgroundColor: i < pin.length ? '#0F172A' : '#E2E8F0' }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Confirmar PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={confirm}
                  onChange={(e) => handlePinInput(e.target.value, setConfirm)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="Repite el PIN"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-center font-mono"
                  style={{
                    border: `1.5px solid ${confirm && confirm !== pin ? '#FECACA' : '#E2E8F0'}`,
                    color: '#1E293B',
                    backgroundColor: '#F8FAFC',
                    letterSpacing: confirm ? '0.4em' : undefined,
                  }}
                />
                {confirm && confirm !== pin && (
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
                  disabled={saving || pin.length < 4 || pin !== confirm}
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
