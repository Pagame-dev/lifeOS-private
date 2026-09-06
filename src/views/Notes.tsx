import { useEffect, useState } from 'react';
import { Lightbulb, Plus, X, Trash2, Inbox, Clock, Layers, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Note, LifeArea } from '@/lib/types';

type Tab = 'notes' | 'areas';

export function Notes() {
  const [tab, setTab] = useState<Tab>('notes');

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-cream">Notes & Life Areas</h1>
      <div className="flex gap-1 p-1 bg-charcoal-900/50 rounded-lg w-fit">
        {(['notes', 'areas'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
              tab === t ? 'bg-charcoal-700 text-cream' : 'text-cream-dim hover:text-cream'
            }`}
          >
            {t === 'notes' ? 'Notes' : 'Life Areas'}
          </button>
        ))}
      </div>
      {tab === 'notes' ? <NotesTab /> : <AreasTab />}
    </div>
  );
}

function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'inbox' | 'someday'>('all');
  const [newContent, setNewContent] = useState('');

  async function loadData() {
    const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
    setNotes((data as Note[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addNote() {
    if (!newContent.trim()) return;
    await supabase.from('notes').insert({ content: newContent.trim(), category: 'inbox' });
    setNewContent('');
    loadData();
  }

  async function moveToCategory(note: Note, category: 'inbox' | 'someday') {
    await supabase.from('notes').update({ category }).eq('id', note.id);
    loadData();
  }

  async function archiveNote(note: Note) {
    await supabase.from('notes').update({ is_archived: true }).eq('id', note.id);
    loadData();
  }

  async function deleteNote(note: Note) {
    await supabase.from('notes').delete().eq('id', note.id);
    loadData();
  }

  const filtered = notes.filter((n) => !n.is_archived && (filter === 'all' || n.category === filter));

  if (loading) return <div className="glass-card h-64 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex gap-2">
        <input
          type="text"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
          className="input-field flex-1"
          placeholder="Quick note..."
          autoFocus
        />
        <button onClick={addNote} disabled={!newContent.trim()} className="btn-primary px-4 disabled:opacity-50">
          <Plus size={16} />
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-charcoal-900/50 rounded-lg w-fit">
        {(['all', 'inbox', 'someday'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
              filter === f ? 'bg-charcoal-700 text-cream' : 'text-cream-dim hover:text-cream'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Lightbulb size={24} className="mx-auto text-cream-dim/40 mb-2" />
          <p className="text-sm text-cream-dim">No notes here</p>
          <p className="text-xs text-cream-dim/60 mt-1">Capture ideas, thoughts, and reminders above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => (
            <div key={note.id} className="glass-card px-4 py-3 group">
              <p className="text-sm text-cream whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    note.category === 'inbox'
                      ? 'bg-sage-500/10 text-sage-300 border-sage-500/15'
                      : 'bg-accent-cool/10 text-accent-cool border-accent-cool/15'
                  }`}>
                    {note.category === 'inbox' ? 'Inbox' : 'Someday'}
                  </span>
                  <span className="text-[10px] text-cream-dim/50">
                    {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {note.category === 'inbox' ? (
                    <button onClick={() => moveToCategory(note, 'someday')} className="p-1.5 rounded text-cream-dim hover:text-accent-cool transition-colors" title="Move to Someday">
                      <Clock size={13} />
                    </button>
                  ) : (
                    <button onClick={() => moveToCategory(note, 'inbox')} className="p-1.5 rounded text-cream-dim hover:text-sage-300 transition-colors" title="Move to Inbox">
                      <Inbox size={13} />
                    </button>
                  )}
                  <button onClick={() => archiveNote(note)} className="p-1.5 rounded text-cream-dim hover:text-cream transition-colors" title="Archive">
                    <Check size={13} />
                  </button>
                  <button onClick={() => deleteNote(note)} className="p-1.5 rounded text-cream-dim/40 hover:text-red-400/70 transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AREA_COLORS = [
  '#8b9a6b', '#7a8fa3', '#c4a97d', '#a070a0',
  '#5e8b7e', '#b07d5e', '#6b7a8e', '#9e8b6b',
];

function AreasTab() {
  const [areas, setAreas] = useState<LifeArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(AREA_COLORS[0]);

  async function loadData() {
    const { data } = await supabase.from('life_areas').select('*').order('sort_order');
    setAreas((data as LifeArea[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addArea() {
    if (!newName.trim()) return;
    await supabase.from('life_areas').insert({
      name: newName.trim(),
      color: newColor,
      sort_order: areas.length,
    });
    setNewName('');
    setNewColor(AREA_COLORS[0]);
    setCreating(false);
    loadData();
  }

  async function deleteArea(area: LifeArea) {
    await supabase.from('life_areas').delete().eq('id', area.id);
    loadData();
  }

  async function archiveArea(area: LifeArea) {
    await supabase.from('life_areas').update({ is_archived: true }).eq('id', area.id);
    loadData();
  }

  if (loading) return <div className="glass-card h-64 animate-pulse" />;

  const activeAreas = areas.filter((a) => !a.is_archived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-cream-dim">Organize your life into meaningful areas</p>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Plus size={16} /> Add Area
          </button>
        )}
      </div>

      {creating && (
        <div className="glass-card p-4 space-y-3 animate-slide-up">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewColor(AREA_COLORS[(AREA_COLORS.indexOf(newColor) + 1) % AREA_COLORS.length])}
              className="w-8 h-8 rounded-full shrink-0 border border-white/10"
              style={{ backgroundColor: newColor }}
            />
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input-field flex-1" placeholder="Area name (e.g. Health, School, Relationships)" autoFocus />
          </div>
          <div className="flex gap-2">
            <button onClick={addArea} disabled={!newName.trim()} className="btn-primary flex-1 py-2.5 disabled:opacity-50">Add</button>
            <button onClick={() => setCreating(false)} className="btn-ghost px-4">Cancel</button>
          </div>
        </div>
      )}

      {activeAreas.length === 0 && !creating ? (
        <div className="glass-card p-8 text-center">
          <Layers size={24} className="mx-auto text-cream-dim/40 mb-2" />
          <p className="text-sm text-cream-dim">No life areas yet</p>
          <p className="text-xs text-cream-dim/60 mt-1">Create areas like Health, School, or Relationships to organize your goals</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeAreas.map((area) => (
            <div key={area.id} className="glass-card px-4 py-3 flex items-center gap-3 group">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
              <span className="text-sm font-medium text-cream flex-1">{area.name}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => archiveArea(area)} className="p-1.5 rounded text-cream-dim hover:text-cream transition-colors" title="Archive">
                  <Check size={13} />
                </button>
                <button onClick={() => deleteArea(area)} className="p-1.5 rounded text-cream-dim/40 hover:text-red-400/70 transition-colors" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
