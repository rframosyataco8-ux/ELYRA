import { ChevronRight, ScanFace } from 'lucide-react';
import type { LabUser } from '@/lib/users';
import { hasFaceRegistered } from '@/lib/faceAuth';

interface UserCardProps {
  user: LabUser;
  selected?: boolean;
  onSelect: () => void;
}

export function UserCard({ user, selected, onSelect }: UserCardProps) {
  const face = hasFaceRegistered(user.id);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-[background-color,border-color,box-shadow,transform] duration-200 group"
      style={{
        background: selected
          ? 'linear-gradient(90deg, rgba(28,96,190,0.32) 0%, rgba(14,40,85,0.22) 100%)'
          : 'rgba(255,255,255,0.028)',
        border: selected
          ? '1px solid rgba(56,180,255,0.5)'
          : '1px solid rgba(255,255,255,0.055)',
        boxShadow: selected ? '0 0 16px rgba(56,180,255,0.12)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (selected) return;
        e.currentTarget.style.borderColor = 'rgba(56,180,255,0.28)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.045)';
      }}
      onMouseLeave={(e) => {
        if (selected) return;
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.055)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.028)';
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[12.5px] font-semibold shrink-0"
        style={{
          background: selected ? 'rgba(56,180,255,0.28)' : 'rgba(255,255,255,0.06)',
          color: selected ? '#7dd3fc' : '#94a3b8',
        }}
      >
        {user.displayName.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-white truncate leading-tight">
          {user.displayName}
        </p>
        <p className="text-[11px] text-sky-100/42 truncate mt-0.5">
          {user.roleLabel}
          {face ? ' · Rostro' : ''}
        </p>
      </div>

      {face && (
        <ScanFace className="w-3.5 h-3.5 text-sky-400/80 shrink-0" aria-label="Biometría facial" />
      )}

      {user.isAdmin && (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0"
          style={{
            background: 'rgba(56,180,255,0.14)',
            color: '#7dd3fc',
            border: '1px solid rgba(56,180,255,0.28)',
          }}
        >
          Admin
        </span>
      )}

      <ChevronRight className="w-3.5 h-3.5 text-sky-100/22 group-hover:text-sky-300/55 shrink-0 transition-colors duration-200" />
    </button>
  );
}
