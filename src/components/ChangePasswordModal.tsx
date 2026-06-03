import { useState } from 'react';
import { X, KeyRound, Eye, EyeOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    setError('');
    if (!current) { setError('Introduce tu contrasena actual.'); return; }
    if (next.length < 8) { setError('La nueva contrasena debe tener al menos 8 caracteres.'); return; }
    if (next !== confirm) { setError('Las contrasenas no coinciden.'); return; }

    setSaving(true);
    try {
      // Re-authenticate to verify current password
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No se pudo obtener el usuario actual.');

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (signInErr) { setError('La contrasena actual no es correcta.'); return; }

      // Update to new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) throw updateErr;

      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cambiar la contrasena.');
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
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <KeyRound size={15} className="text-white" />
            </div>
            <h2 className="text-white font-semibold text-sm">Cambiar Contrasena</h2>
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
              <p className="font-semibold text-sm" style={{ color: '#065F46' }}>Contrasena actualizada</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Tu nueva contrasena esta activa desde ahora.</p>
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
              {/* Current password */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Contrasena actual
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={current}
                    onChange={(e) => { setCurrent(e.target.value); setError(''); }}
                    placeholder="Tu contrasena actual"
                    className="w-full px-4 pr-10 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: '#94A3B8' }}
                  >
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Nueva contrasena
                </label>
                <div className="relative">
                  <input
                    type={showNext ? 'text' : 'password'}
                    value={next}
                    onChange={(e) => { setNext(e.target.value); setError(''); }}
                    placeholder="Minimo 8 caracteres"
                    className="w-full px-4 pr-10 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNext((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: '#94A3B8' }}
                  >
                    {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {next.length > 0 && next.length < 8 && (
                  <p className="text-xs mt-1" style={{ color: '#F59E0B' }}>Minimo 8 caracteres ({next.length}/8)</p>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Confirmar nueva contrasena
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="Repite la nueva contrasena"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    border: `1.5px solid ${confirm && confirm !== next ? '#FECACA' : '#E2E8F0'}`,
                    color: '#1E293B',
                    backgroundColor: '#F8FAFC',
                  }}
                />
                {confirm && confirm !== next && (
                  <p className="text-xs mt-1" style={{ color: '#DC2626' }}>Las contrasenas no coinciden</p>
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
                  disabled={saving || !current || next.length < 8 || next !== confirm}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#0F172A' }}
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  Guardar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
