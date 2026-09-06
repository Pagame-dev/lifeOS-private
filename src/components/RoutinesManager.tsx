import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Routine, RoutineStep } from '@/lib/types';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

export function RoutinesManager() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [stepsByRoutine, setStepsByRoutine] = useState<Record<string, RoutineStep[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('07:00');
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);

  async function load() {
    const { data: routinesData } = await supabase.from('routines').select('*').order('name');
    const routinesList = (routinesData as Routine[]) || [];
    setRoutines(routinesList);

    const stepsMap: Record<string, RoutineStep[]> = {};
    for (const routine of routinesList) {
      const { data: stepsData } = await supabase
        .from('routine_steps')
        .select('*')
        .eq('routine_id', routine.id)
        .order('sort_order');
      stepsMap[routine.id] = (stepsData as RoutineStep[]) || [];
    }
    setStepsByRoutine(stepsMap);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addRoutine() {
    if (!newName.trim()) return;
    const { data } = await supabase
      .from('routines')
      .insert({
        name: newName.trim(),
        start_time: newTime,
        applicable_days: newDays,
        is_active: true,
      })
      .select('id')
      .single();
    setNewName('');
    setNewTime('07:00');
    setNewDays([1, 2, 3, 4, 5]);
    setAdding(false);
    if (data) setExpanded(data.id);
    load();
  }

  async function deleteRoutine(id: string) {
    await supabase.from('routines').delete().eq('id', id);
    load();
  }

  async function toggleActive(routine: Routine) {
    await supabase.from('routines').update({ is_active: !routine.is_active }).eq('id', routine.id);
    load();
  }

  async function addStep(routineId: string) {
    const steps = stepsByRoutine[routineId] || [];
    const sortOrder = steps.length;
    await supabase.from('routine_steps').insert({
      routine_id: routineId,
      title: 'New step',
      duration_min: 5,
      sort_order: sortOrder,
      is_required: true,
    });
    load();
  }

  async function updateStep(step: RoutineStep, patch: Partial<RoutineStep>) {
    await supabase.from('routine_steps').update(patch).eq('id', step.id);
    load();
  }

  async function deleteStep(step: RoutineStep) {
    await supabase.from('routine_steps').delete().eq('id', step.id);
    load();
  }

  async function moveStep(step: RoutineStep, dir: 'up' | 'down') {
    const steps = stepsByRoutine[step.routine_id] || [];
    const idx = steps.findIndex((s) => s.id === step.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= steps.length) return;
    const other = steps[swapIdx];
    await Promise.all([
      supabase.from('routine_steps').update({ sort_order: other.sort_order }).eq('id', step.id),
      supabase.from('routine_steps').update({ sort_order: step.sort_order }).eq('id', other.id),
    ]);
    load();
  }

  if (loading) return <div className="glass-card h-40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-cream">Routines</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      {adding && (
        <div className="glass-card p-4 space-y-3 animate-slide-up">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input-field"
            placeholder="Routine name (e.g. Morning routine)"
            autoFocus
          />
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Start Time</label>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Days</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_INDICES.map((dayIdx, i) => {
                const selected = newDays.includes(dayIdx);
                return (
                  <button
                    key={dayIdx}
                    onClick={() => {
                      setNewDays(selected
                        ? newDays.filter((d) => d !== dayIdx)
                        : [...newDays, dayIdx]);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      selected
                        ? 'bg-sage-500/15 text-sage-200 border-sage-500/25'
                        : 'text-cream-dim border-white/[0.06] hover:text-cream'
                    }`}
                  >
                    {DAY_LABELS[i]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRoutine} disabled={!newName.trim()} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
              Add Routine
            </button>
            <button onClick={() => setAdding(false)} className="btn-ghost px-4">
              Cancel
            </button>
          </div>
        </div>
      )}

      {routines.length === 0 && !adding ? (
        <div className="glass-card p-8 text-center">
          <Clock size={24} className="mx-auto text-cream-dim/40 mb-2" />
          <p className="text-sm text-cream-dim">No routines yet</p>
          <p className="text-xs text-cream-dim/60 mt-1">Routines help you build consistent daily habits</p>
        </div>
      ) : (
        <div className="space-y-2">
          {routines.map((routine) => {
            const isExpanded = expanded === routine.id;
            const steps = stepsByRoutine[routine.id] || [];
            return (
              <div key={routine.id} className="glass-card overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : routine.id)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div className={`w-2 h-2 rounded-full ${routine.is_active ? 'bg-sage-400' : 'bg-cream-dim/30'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${routine.is_active ? 'text-cream' : 'text-cream-dim'}`}>
                        {routine.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {routine.start_time && (
                          <span className="text-xs text-cream-dim font-mono">{routine.start_time}</span>
                        )}
                        <span className="text-xs text-cream-dim">
                          {routine.applicable_days?.length === 7
                            ? 'Every day'
                            : routine.applicable_days?.map((d) => DAY_LABELS[DAY_INDICES.indexOf(d)]).join(', ')}
                        </span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => toggleActive(routine)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      routine.is_active
                        ? 'text-sage-300 bg-sage-500/10'
                        : 'text-cream-dim bg-white/[0.03]'
                    }`}
                  >
                    {routine.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => deleteRoutine(routine.id)}
                    className="text-cream-dim/40 hover:text-red-400/70 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/[0.04] p-3 space-y-2 animate-slide-up">
                    {steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02]">
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveStep(step, 'up')}
                            disabled={i === 0}
                            className="text-cream-dim/40 hover:text-cream disabled:opacity-20"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={() => moveStep(step, 'down')}
                            disabled={i === steps.length - 1}
                            className="text-cream-dim/40 hover:text-cream disabled:opacity-20"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) => updateStep(step, { title: e.target.value })}
                          className="input-field flex-1 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          value={step.duration_min}
                          onChange={(e) => updateStep(step, { duration_min: parseInt(e.target.value) || 1 })}
                          className="input-field w-16 py-1.5 text-sm text-center"
                          min={1}
                        />
                        <span className="text-xs text-cream-dim">min</span>
                        <button
                          onClick={() => deleteStep(step)}
                          className="text-cream-dim/40 hover:text-red-400/70 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addStep(routine.id)}
                      className="btn-ghost flex items-center gap-1.5 text-sm w-full justify-center py-2"
                    >
                      <Plus size={14} /> Add step
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
