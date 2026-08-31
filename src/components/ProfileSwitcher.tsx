import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronDown, Users, ShieldCheck, UserCog, ClipboardCheck, CheckCircle2, Building2, Award, Ligature as FileSignature } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ProfileOption {
  label: string;
  view: string;
  icon: LucideIcon;
  color: string;
}

interface Props {
  currentLabel: string;
  options: ProfileOption[];
  onNavigate: (view: string) => void;
  headerText?: string;
}

export default function ProfileSwitcher({ currentLabel, options, onNavigate, headerText = '#E0F2FE' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const otherOptions = options.filter((o) => o.label !== currentLabel);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => otherOptions.length > 0 ? setOpen(!open) : onNavigate(options[0]?.view ?? 'dashboard')}
        title={otherOptions.length > 0 ? 'Cambiar de perfil' : `Volver a ${currentLabel}`}
        className="flex items-center gap-1 rounded-xl flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: headerText, padding: '8px 10px' }}
      >
        <ChevronLeft size={16} />
        {otherOptions.length > 0 && <ChevronDown size={12} className="-ml-1" />}
      </button>
      {open && otherOptions.length > 0 && (
        <div
          className="absolute top-full left-0 mt-1.5 min-w-[200px] rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
        >
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', borderBottom: '1px solid #F1F5F9' }}>
            Cambiar de perfil
          </div>
          {otherOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.view}
                onClick={() => { setOpen(false); onNavigate(opt.view); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors hover:bg-slate-50"
                style={{ color: '#1E293B' }}
              >
                <Icon size={14} style={{ color: opt.color }} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
