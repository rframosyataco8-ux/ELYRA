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
      className="w-full flex items-center gap-3 px-3.5 py-[13px] rounded-[14px] text-left transition-all duration-200 group"
      style={{
        background: selected || face
          ? 'linear-gradient(90deg, rgba(30,100,210,0.38) 0%, rgba(16,45,95,0.28) 100%)'
          : 'rgba(255,255,255,0.03)',
        border:
          selected || face
            ? '1px solid rgba(56,180,255,0.65)'
            : '1px solid rgba(255,255,255,0.06)',
        boxShadow:
          selected || face
            ? '0 0 20px rgba(56,180,255,0.18), inset 0 1px 0 rgba(255,255,255,0.04)'
            : 'none',
      }}
      onMouseEnter={(e) => {
        if (selected || face) return;
        e.currentTarget.style.borderColor = 'rgba(56,180,255,0.35)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
      }}
      onMouseLeave={(e) => {
        if (selected || face) return;
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
        style={{
          background: face || selected ? 'rgba(56,180,255,0.32)' : 'rgba(255,255,255,0.07)',
          color: face || selected ? '#7dd3fc' : '#94a3b8',
        }}
      >
        {user.displayName.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-white truncate leading-tight">
          {user.displayName}
        </p>
        <p className="text-[11px] text-sky-100/45 truncate mt-0.5">
          {user.roleLabel}
          {face ? ' · Rostro' : ''}
        </p>
      </div>

      {face && <ScanFace className="w-[15px] h-[15px] text-sky-400 shrink-0" />}

      {user.isAdmin && (
        <span
          className="text-[10px] font-semibold px-2 py-[3px] rounded-md shrink-0"
          style={{
            background: 'rgba(56,180,255,0.2)',
            color: '#7dd3fc',
            border: '1px solid rgba(56,180,255,0.35)',
          }}
        >
          Admin
        </span>
      )}

      <ChevronRight className="w-4 h-4 text-sky-100/25 group-hover:text-sky-300/70 shrink-0 transition-colors" />
    </button>
  );
}
