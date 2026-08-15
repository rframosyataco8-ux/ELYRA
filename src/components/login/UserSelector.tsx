import type { LabUser } from '@/lib/users';
import { UserCard } from './UserCard';

interface UserSelectorProps {
  users: LabUser[];
  selectedId?: string | null;
  onSelect: (user: LabUser) => void;
}

export function UserSelector({ users, selectedId, onSelect }: UserSelectorProps) {
  return (
    <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-0.5">
      {users.map((u) => (
        <UserCard
          key={u.id}
          user={u}
          selected={selectedId === u.id}
          onSelect={() => onSelect(u)}
        />
      ))}
      {users.length === 0 && (
        <p className="text-sm text-center py-6 text-sky-100/40">No hay usuarios activos.</p>
      )}
    </div>
  );
}
