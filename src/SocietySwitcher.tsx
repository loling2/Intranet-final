import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { societies } from './themes';
import { useSociety } from './context/SocietyContext';

interface Props {
  allowedSocieties?: string[];
  textColor?: string;
  bgColor?: string;
  borderColor?: string;
}

export default function SocietySwitcher({ allowedSocieties, textColor = '#CBD5E1', bgColor = 'rgba(255,255,255,0.08)', borderColor = 'rgba(255,255,255,0.1)' }: Props) {
  const { activeSocietyId, setActiveSocietyId } = useSociety();
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const available = allowedSocieties
    ? societies.filter((s) => allowedSocieties.includes(s.id))
    : societies;

  const active = available.find((s) => s.id === activeSocietyId) ?? available[0];

  if (available.length <= 1) return null;

  const handleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dropdown = open
    ? createPortal(
        <div
          className="fixed rounded-xl overflow-hidden shadow-2xl"
          style={{
            top: dropdownPos.top,
            right: dropdownPos.right,
            zIndex: 9999,
            minWidth: 220,
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
              Cambiar Sociedad
            </p>
          </div>
          {available.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActiveSocietyId(s.id); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-slate-50 cursor-pointer"
              style={{ backgroundColor: activeSocietyId === s.id ? s.primaryLight : 'transparent' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0"
                style={{ backgroundColor: `${s.primary}15`, color: s.primary, fontSize: '13px' }}
              >
                {s.logoLetter}
              </div>
              <p className="flex-1 text-sm font-medium" style={{ color: s.textPrimary }}>{s.name}</p>
              {activeSocietyId === s.id && (
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.primary }} />
              )}
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200"
        style={{ backgroundColor: bgColor, color: textColor, border: `1px solid ${borderColor}` }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs"
          style={{ backgroundColor: active ? `${active.primary}30` : 'rgba(255,255,255,0.15)', color: active?.primary ?? '#FFFFFF' }}
        >
          {active?.logoLetter ?? '?'}
        </div>
        <span className="hidden sm:inline">{active?.name ?? 'Sociedad'}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </>
  );
}
