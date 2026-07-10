import { useState } from 'react';
import { KeyRound, X, Loader2, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Props {
  userId: string;
  userName: string;
  currentPin?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function PinChangeModal({ userId, userName, currentPin, onClose, onSaved }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setError('');
    if (pin.length < 4) { setError('El PIN debe tener al menos 4 dígitos'); return; }
    if (!/^\d+$/.test(pin)) { setError('El PIN solo puede contener números'); return; }
    if (pin !== confirm) { setError('Los PINs no coinciden'); return; }
    setSaving(true);
    const { error: e } = await supabase
      .from('user_profiles')
      .update({ pin, updated_at: new Date().toISOString() })
      .eq('id', userId);
    setSaving(false);
    if (e) { setError(e.message); return; }
    setSuccess(true);
    setTimeout(() => { onSaved(); onClose(); }, 800);
  };

  const inp = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none tracking-widest font-mono';
  const inpS = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <KeyRound size={16} style={{ color: '#0EA5E9' }} />
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Cambiar PIN</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
            <X size={15} style={{ color: '#64748B' }} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="px-3 py-2.5 rounded-xl text-sm" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
            <p className="font-medium" style={{ color: '#0284C7' }}>{userName}</p>
            <p className="text-xs mt-0.5" style={{ color: '#38BDF8' }}>{currentPin ? 'PIN actual configurado' : 'Sin PIN configurado'}</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }}>
              <Check size={14} /> PIN actualizado correctamente
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Nuevo PIN (mínimo 4 dígitos)</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className={`${inp} pr-10`}
                style={inpS}
              />
              <button type="button" onClick={() => setShowPin((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showPin ? <EyeOff size={14} style={{ color: '#94A3B8' }} /> : <Eye size={14} style={{ color: '#94A3B8' }} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Confirmar PIN</label>
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className={inp}
              style={{ ...inpS, borderColor: confirm && pin && confirm !== pin ? '#FCA5A5' : '#E2E8F0' }}
            />
            {confirm && pin && confirm !== pin && (
              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>Los PINs no coinciden</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || success || pin.length < 4 || pin !== confirm}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {success ? 'Guardado' : 'Guardar PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}
