import { useState, useEffect, useRef } from 'react';
import { Upload, Palette, CheckCircle2, AlertCircle, RefreshCw, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { societies as staticSocieties } from '../themes';

interface SocietyColorOverride {
  societyId: string;
  primary: string;
  gradientFrom: string;
  gradientTo: string;
}

export default function CssPanel() {
  const [bgImage, setBgImage] = useState<string>('/foto1_(2).png');
  const [bgUploading, setBgUploading] = useState(false);
  const [bgSuccess, setBgSuccess] = useState(false);
  const [bgError, setBgError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [colorModal, setColorModal] = useState<string | null>(null); // societyId
  const [colorPrimary, setColorPrimary] = useState('#0E7C6B');
  const [colorGradFrom, setColorGradFrom] = useState('#0E7C6B');
  const [colorGradTo, setColorGradTo] = useState('#0A5E51');
  const [colorSaving, setColorSaving] = useState(false);
  const [colorSuccess, setColorSuccess] = useState(false);
  const [colorError, setColorError] = useState('');
  const [overrides, setOverrides] = useState<Record<string, SocietyColorOverride>>({});

  useEffect(() => {
    supabase
      .from('ui_settings')
      .select('key, value')
      .maybeSingle()
      .then(() => {});

    supabase
      .from('ui_settings')
      .select('key, value')
      .then(({ data }) => {
        if (!data) return;
        const bg = data.find((r) => r.key === 'login_background');
        if (bg) setBgImage(bg.value);

        const map: Record<string, SocietyColorOverride> = {};
        for (const row of data) {
          const m = row.key.match(/^society_color_(.+)$/);
          if (m) {
            try {
              const parsed = JSON.parse(row.value) as SocietyColorOverride;
              map[m[1]] = parsed;
            } catch { /* skip */ }
          }
        }
        setOverrides(map);
      });
  }, []);

  const handleBgUpload = async (file: File) => {
    setBgError('');
    setBgSuccess(false);
    setBgUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `ui/login_bg_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: saveErr } = await supabase
        .from('ui_settings')
        .upsert({ key: 'login_background', value: publicUrl, updated_at: new Date().toISOString() });
      if (saveErr) throw new Error(saveErr.message);

      setBgImage(publicUrl);
      setBgSuccess(true);
      setTimeout(() => setBgSuccess(false), 3000);
    } catch (err) {
      setBgError(err instanceof Error ? err.message : 'Error al subir imagen');
    } finally {
      setBgUploading(false);
    }
  };

  const openColorModal = (societyId: string) => {
    const override = overrides[societyId];
    const base = staticSocieties.find((s) => s.id === societyId);
    setColorPrimary(override?.primary ?? base?.primary ?? '#0E7C6B');
    setColorGradFrom(override?.gradientFrom ?? base?.gradientFrom ?? '#0E7C6B');
    setColorGradTo(override?.gradientTo ?? base?.gradientTo ?? '#0A5E51');
    setColorError('');
    setColorSuccess(false);
    setColorModal(societyId);
  };

  const handleSaveColor = async () => {
    if (!colorModal) return;
    setColorError('');
    setColorSuccess(false);
    setColorSaving(true);
    try {
      const payload: SocietyColorOverride = {
        societyId: colorModal,
        primary: colorPrimary,
        gradientFrom: colorGradFrom,
        gradientTo: colorGradTo,
      };
      const { error } = await supabase
        .from('ui_settings')
        .upsert({ key: `society_color_${colorModal}`, value: JSON.stringify(payload), updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      setOverrides((prev) => ({ ...prev, [colorModal]: payload }));
      setColorSuccess(true);
      setTimeout(() => { setColorSuccess(false); setColorModal(null); }, 1500);
    } catch (err) {
      setColorError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setColorSaving(false);
    }
  };

  const handleResetColor = async (societyId: string) => {
    await supabase.from('ui_settings').delete().eq('key', `society_color_${societyId}`);
    setOverrides((prev) => { const next = { ...prev }; delete next[societyId]; return next; });
  };

  return (
    <div className="space-y-8">
      {/* Login Background */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
            <ImageIcon size={18} style={{ color: '#2563EB' }} />
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Imagen de Fondo — Pantalla de Login</h3>
            <p className="text-xs" style={{ color: '#64748B' }}>Sube una nueva imagen para el fondo de la pantalla de inicio de sesion</p>
          </div>
        </div>
        <div className="p-6 flex flex-col sm:flex-row items-start gap-6">
          {/* Preview */}
          <div className="relative flex-shrink-0 rounded-xl overflow-hidden shadow-md" style={{ width: 200, height: 120, border: '2px solid #E2E8F0' }}>
            <img src={bgImage} alt="Fondo actual" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-end px-3 py-2" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }}>
              <span className="text-white text-xs font-medium">Vista previa actual</span>
            </div>
          </div>

          {/* Upload area */}
          <div className="flex-1 space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all duration-200 hover:opacity-80 p-8"
              style={{ backgroundColor: '#F8FAFC', border: '2px dashed #CBD5E1' }}
            >
              {bgUploading
                ? <RefreshCw size={24} className="animate-spin" style={{ color: '#64748B' }} />
                : <Upload size={24} style={{ color: '#64748B' }} />}
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: '#334155' }}>
                  {bgUploading ? 'Subiendo imagen...' : 'Haz clic para seleccionar imagen'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>PNG, JPG, WEBP — recomendado 1920×1080px</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBgUpload(f); e.target.value = ''; }}
            />
            {bgSuccess && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                <p className="text-xs font-medium" style={{ color: '#15803D' }}>Imagen actualizada correctamente</p>
              </div>
            )}
            {bgError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle size={14} style={{ color: '#DC2626' }} />
                <p className="text-xs" style={{ color: '#DC2626' }}>{bgError}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Society Colors */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
            <Palette size={18} style={{ color: '#EA580C' }} />
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Colores por Sociedad</h3>
            <p className="text-xs" style={{ color: '#64748B' }}>Personaliza el color principal y degradado de cada portal</p>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {staticSocieties.map((s) => {
            const override = overrides[s.id];
            const activePrimary = override?.primary ?? s.primary;
            const activeFrom = override?.gradientFrom ?? s.gradientFrom;
            const activeTo = override?.gradientTo ?? s.gradientTo;
            return (
              <div key={s.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ background: `linear-gradient(135deg, ${activeFrom}, ${activeTo})` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                      <span className="text-white font-bold text-sm">{s.logoLetter}</span>
                    </div>
                    <span className="text-white font-semibold text-sm">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {override && (
                      <button
                        onClick={() => handleResetColor(s.id)}
                        className="px-2 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 hover:opacity-80"
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }}
                        title="Restaurar color original"
                      >
                        <X size={11} />
                      </button>
                    )}
                    <button
                      onClick={() => openColorModal(s.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 hover:opacity-80"
                      style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.25)' }}
                    >
                      <Palette size={12} />
                      Color
                    </button>
                  </div>
                </div>
                <div className="px-4 py-2 flex items-center gap-3" style={{ backgroundColor: '#F8FAFC' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: activePrimary }} />
                    <span className="text-xs font-mono" style={{ color: '#64748B' }}>{activePrimary}</span>
                  </div>
                  {override && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#FEF9C3', color: '#A16207' }}>
                      Personalizado
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Color Modal */}
      {colorModal && (() => {
        const s = staticSocieties.find((x) => x.id === colorModal);
        if (!s) return null;
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">
              <div className="px-6 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${colorGradFrom}, ${colorGradTo})` }}>
                <div className="flex items-center gap-2">
                  <Palette size={18} className="text-white" />
                  <div>
                    <h3 className="text-white font-bold text-sm">Color — {s.name}</h3>
                    <p className="text-white/60 text-xs">Vista previa en tiempo real</p>
                  </div>
                </div>
                <button onClick={() => setColorModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                  <X size={14} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#64748B' }}>
                    Color Principal
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={colorPrimary}
                      onChange={(e) => { setColorPrimary(e.target.value); setColorGradFrom(e.target.value); }}
                      className="w-12 h-10 rounded-xl cursor-pointer border-0 p-0.5"
                      style={{ border: '1.5px solid #E2E8F0' }}
                    />
                    <input
                      type="text"
                      value={colorPrimary}
                      onChange={(e) => { setColorPrimary(e.target.value); setColorGradFrom(e.target.value); }}
                      className="flex-1 px-3 py-2 rounded-xl text-sm font-mono outline-none"
                      style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#64748B' }}>
                    Color Degradado (tono oscuro)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={colorGradTo}
                      onChange={(e) => setColorGradTo(e.target.value)}
                      className="w-12 h-10 rounded-xl cursor-pointer border-0 p-0.5"
                      style={{ border: '1.5px solid #E2E8F0' }}
                    />
                    <input
                      type="text"
                      value={colorGradTo}
                      onChange={(e) => setColorGradTo(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl text-sm font-mono outline-none"
                      style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                    />
                  </div>
                </div>

                {colorError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <AlertCircle size={13} style={{ color: '#DC2626' }} />
                    <p className="text-xs" style={{ color: '#DC2626' }}>{colorError}</p>
                  </div>
                )}
                {colorSuccess && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <CheckCircle2 size={13} style={{ color: '#16A34A' }} />
                    <p className="text-xs font-medium" style={{ color: '#15803D' }}>Color guardado correctamente</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setColorModal(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                    style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveColor}
                    disabled={colorSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg, ${colorGradFrom}, ${colorGradTo})` }}
                  >
                    {colorSaving && <RefreshCw size={13} className="animate-spin" />}
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
