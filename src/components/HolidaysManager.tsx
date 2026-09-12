import { useEffect, useState } from 'react';
import { Plus, Trash2, CalendarOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { localDateKey } from '@/lib/date-utils';
import type { Holiday } from '@/lib/types';

export function HolidaysManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newLabel, setNewLabel] = useState('School Holiday');

  async function load() {
    const { data } = await supabase.from('holidays').select('*').order('date', { ascending: false });
    setHolidays((data as Holiday[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addHoliday() {
    if (!newDate) return;
    await supabase.from('holidays').insert({
      date: newDate,
      label: newLabel.trim() || 'School Holiday',
    });
    setNewDate('');
    setNewLabel('School Holiday');
    setAdding(false);
    load();
  }

  async function deleteHoliday(id: string) {
    await supabase.from('holidays').delete().eq('id', id);
    load();
  }

  if (loading) return <div className="glass-card h-40 animate-pulse" />;

  const today = localDateKey();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-cream">School Holidays</h2>
          <p className="text-xs text-cream-dim mt-1">On holidays, school lessons disappear but personal events stay</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Plus size={16} /> Mark Date
          </button>
        )}
      </div>

      {adding && (
        <div className="glass-card p-4 space-y-3 animate-slide-up">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="input-field"
              min={today}
            />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Label (optional)</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="input-field"
              placeholder="School Holiday"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addHoliday} disabled={!newDate} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
              Mark as Holiday
            </button>
            <button onClick={() => setAdding(false)} className="btn-ghost px-4">
              Cancel
            </button>
          </div>
        </div>
      )}

      {holidays.length === 0 && !adding ? (
        <div className="glass-card p-8 text-center">
          <CalendarOff size={24} className="mx-auto text-cream-dim/40 mb-2" />
          <p className="text-sm text-cream-dim">No holidays marked</p>
          <p className="text-xs text-cream-dim/60 mt-1">Mark a date to hide school lessons on that day</p>
        </div>
      ) : (
        <div className="space-y-2">
          {holidays.map((holiday) => {
            const isPast = new Date(holiday.date) < new Date(today);
            return (
              <div
                key={holiday.id}
                className={`glass-card px-4 py-3 flex items-center justify-between ${isPast ? 'opacity-50' : ''}`}
              >
                <div>
                  <p className="text-sm font-medium text-cream">
                    {new Date(holiday.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-cream-dim mt-0.5">{holiday.label}</p>
                </div>
                <button
                  onClick={() => deleteHoliday(holiday.id)}
                  className="text-cream-dim/40 hover:text-red-400/70 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
