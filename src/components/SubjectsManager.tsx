import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Subject } from '@/lib/types';

const COLORS = [
  '#8b9a6b', '#7a8fa3', '#c4a97d', '#a070a0',
  '#5e8b7e', '#b07d5e', '#6b7a8e', '#9e8b6b',
  '#7e6b8b', '#5e9e8b', '#8b7e5e', '#6b9e9e',
];

export function SubjectsManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeacher, setNewTeacher] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  async function load() {
    const { data } = await supabase.from('subjects').select('*').order('name');
    setSubjects((data as Subject[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addSubject() {
    if (!newName.trim()) return;
    await supabase.from('subjects').insert({
      name: newName.trim(),
      teacher: newTeacher.trim(),
      color: newColor,
    });
    setNewName('');
    setNewTeacher('');
    setNewColor(COLORS[0]);
    setAdding(false);
    load();
  }

  async function deleteSubject(id: string) {
    await supabase.from('subjects').delete().eq('id', id);
    load();
  }

  async function updateColor(subject: Subject, color: string) {
    await supabase.from('subjects').update({ color }).eq('id', subject.id);
    load();
  }

  if (loading) return <div className="glass-card h-40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-cream">School Subjects</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      {adding && (
        <div className="glass-card p-4 space-y-3 animate-slide-up">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewColor(COLORS[(COLORS.indexOf(newColor) + 1) % COLORS.length])}
              className="w-8 h-8 rounded-full shrink-0 border border-white/10"
              style={{ backgroundColor: newColor }}
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-field flex-1"
              placeholder="Subject name"
              autoFocus
            />
          </div>
          <input
            type="text"
            value={newTeacher}
            onChange={(e) => setNewTeacher(e.target.value)}
            className="input-field"
            placeholder="Teacher (optional)"
          />
          <div className="flex gap-2">
            <button onClick={addSubject} disabled={!newName.trim()} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
              Add Subject
            </button>
            <button onClick={() => setAdding(false)} className="btn-ghost px-4">
              Cancel
            </button>
          </div>
        </div>
      )}

      {subjects.length === 0 && !adding ? (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-cream-dim">No subjects yet</p>
          <p className="text-xs text-cream-dim/60 mt-1">Add your school subjects to link them with lessons and homework</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subjects.map((subject) => (
            <div key={subject.id} className="glass-card px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => {
                  const nextColor = COLORS[(COLORS.indexOf(subject.color) + 1) % COLORS.length];
                  updateColor(subject, nextColor);
                }}
                className="w-5 h-5 rounded-full shrink-0 border border-white/10"
                style={{ backgroundColor: subject.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cream truncate">{subject.name}</p>
                {subject.teacher && (
                  <p className="text-xs text-cream-dim mt-0.5">{subject.teacher}</p>
                )}
              </div>
              <button
                onClick={() => deleteSubject(subject.id)}
                className="text-cream-dim/40 hover:text-red-400/70 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
