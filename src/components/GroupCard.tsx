import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Group {
  id: string;
  group_id: string;
  group_name: string;
  participant_count: number;
  is_selected: boolean;
  group_image?: string;
  last_activity?: number | null;
  unread_count?: number;
  pinned?: boolean;
}

interface GroupCardProps {
  group: Group;
  onToggle: (groupId: string, currentlySelected: boolean) => void;
  disabled?: boolean;
  showSuggestionBadge?: boolean;
}

export function GroupCard({ group, onToggle, disabled, showSuggestionBadge }: GroupCardProps) {
  // Check if group is active (last activity within 48 hours or has unread messages)
  const isActive = group.last_activity 
    ? (Date.now() - group.last_activity < 48 * 60 * 60 * 1000) || (group.unread_count && group.unread_count > 0)
    : false;

  return (
    <div
      className={`flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200 ${
        group.is_selected 
          ? 'bg-primary/5 border-primary/20 shadow-sm' 
          : 'hover:bg-accent hover:border-accent-foreground/10'
      }`}
    >
      <Checkbox
        id={group.id}
        checked={group.is_selected}
        onCheckedChange={() => onToggle(group.id, group.is_selected)}
        disabled={disabled}
      />
      <Avatar className="h-10 w-10">
        <AvatarImage src={group.group_image} alt={group.group_name} />
        <AvatarFallback>{group.group_name.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">{group.group_name}</p>
          
          {group.is_selected && (
            <Badge variant="default" className="text-xs">
              Conectado
            </Badge>
          )}
          
          {!group.is_selected && isActive && (
            <Badge variant="secondary" className="text-xs">
              🔥 Ativo
            </Badge>
          )}
          
          {group.pinned && (
            <Badge variant="outline" className="text-xs">
              📌
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
          <span>
            {group.participant_count} membro{group.participant_count !== 1 ? 's' : ''}
          </span>
          
          {group.unread_count !== undefined && group.unread_count > 0 && (
            <span className="text-primary font-medium">
              • {group.unread_count} não lida{group.unread_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
