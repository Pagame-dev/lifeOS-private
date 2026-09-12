import { useState, useEffect } from 'react';
import { X, FileText, BookOpen, CalendarPlus, Dumbbell, Lightbulb, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { localDateKey } from '@/lib/date-utils';
import { useAuth } from '@/lib/auth';

interface QuickAddModalProps {
  onClose: () => void;
}

type ItemType = 'task' | 'homework' | 'event' | 'workout' | 'note' | 'goal';

const itemTypes: { id: ItemType; label: string; icon: typeof FileText }[] = [
  { id: 'task', label: 'Task', icon: FileText },
  { id: 'homework', label: 'Homework', icon: BookOpen },
  { id: 'event', label: 'Event', icon: CalendarPlus },
  { id: 'workout', label: 'Workout', icon: Dumbbell },
  { id: 'note', label: 'Note', icon: Lightbulb },
  { id: 'goal', label: 'Goal', icon: Target },
];

export function QuickAddModal({ onClose }: QuickAddModalProps) {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<ItemType>('task');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSave() {
    if (!title.trim() || !user) return;
    setSaving(true);
    setError(null);

    try {
      if (selectedType === 'task') {
        const { error: taskError } = await supabase.from('tasks').insert({
          title: title.trim(),
          due_date: dueDate || null,
        });
        if (taskError) throw taskError;
      } else if (selectedType === 'homework') {
        const { error: hwError } = await supabase.from('homework').insert({
          title: title.trim(),
          due_date: dueDate || localDateKey(),
        });
        if (hwError) throw hwError;
      } else if (selectedType === 'note') {
        const { error: noteError } = await supabase.from('notes').insert({
          content: title.trim(),
          category: 'inbox',
        });
        if (noteError) throw noteError;
      } else if (selectedType === 'workout') {
        const { error: workoutError } = await supabase.from('workouts').insert({
          title: title.trim(),
          scheduled_date: dueDate || localDateKey(),
        });
        if (workoutError) throw workoutError;
      } else if (selectedType === 'event') {
        const { error: eventError } = await supabase.from('timetable_events').insert({
          title: title.trim(),
          day_of_week: new Date(dueDate || Date.now()).getDay(),
          start_time: '09:00',
          end_time: '10:00',
          is_school_lesson: false,
        });
        if (eventError) throw eventError;
      } else if (selectedType === 'goal') {
        const { error: goalError } = await supabase.from('goals').insert({
          title: title.trim(),
        });
        if (goalError) throw goalError;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-charcoal-950/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-cream">Quick Add</h2>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {itemTypes.map((type) => {
            const Icon = type.icon;
            const active = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all ${
                  active
                    ? 'bg-sage-500/10 border-sage-500/25 text-sage-200'
                    : 'border-white/[0.06] text-cream-dim hover:text-cream hover:bg-white/[0.02]'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !saving && handleSave()}
            className="input-field"
            placeholder={`Add a ${selectedType}...`}
            autoFocus
          />

          {selectedType !== 'note' && selectedType !== 'goal' && (
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input-field"
            />
          )}

          {error && (
            <div className="text-sm text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="w-full btn-primary py-2.5 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
