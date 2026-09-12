import { useEffect, useState } from 'react';
import { Check, Circle, Clock, AlertCircle, BookOpen, FileText, X, Plus, Trash2, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { localDateKey } from '@/lib/date-utils';
import type { Task, Homework, Subject } from '@/lib/types';

type Tab = 'all' | 'tasks' | 'homework';
type StatusFilter = 'pending' | 'completed' | 'all';

export function Tasks() {
  const [tab, setTab] = useState<Tab>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [creating, setCreating] = useState<'task' | 'homework' | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  async function loadData() {
    const [tasksRes, hwRes, subjectsRes] = await Promise.all([
      supabase.from('tasks').select('*').order('priority', { ascending: false }),
      supabase.from('homework').select('*').order('due_date'),
      supabase.from('subjects').select('*').order('name'),
    ]);
    setTasks((tasksRes.data as Task[]) || []);
    setHomework((hwRes.data as Homework[]) || []);
    setSubjects((subjectsRes.data as Subject[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleTask(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await supabase
      .from('tasks')
      .update({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null })
      .eq('id', task.id);
    loadData();
  }

  async function toggleHomework(hw: Homework) {
    const newStatus = hw.status === 'done' ? 'todo' : 'done';
    await supabase
      .from('homework')
      .update({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null })
      .eq('id', hw.id);
    loadData();
  }

  async function deleteTask(task: Task) {
    await supabase.from('tasks').delete().eq('id', task.id);
    loadData();
  }

  async function deleteHomework(hw: Homework) {
    await supabase.from('homework').delete().eq('id', hw.id);
    loadData();
  }

  function filterItems<T extends { status: string }>(items: T[]): T[] {
    if (statusFilter === 'pending') return items.filter((i) => i.status !== 'done' && i.status !== 'skipped');
    if (statusFilter === 'completed') return items.filter((i) => i.status === 'done');
    return items;
  }

  const pendingTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
  const pendingHomework = homework.filter((h) => h.status !== 'done' && h.status !== 'skipped');
  const completedTasks = tasks.filter((t) => t.status === 'done');
  const completedHomework = homework.filter((h) => h.status === 'done');

  const shownTasks = filterItems(tasks);
  const shownHomework = filterItems(homework);

  function getSubjectName(id: string | null): string {
    if (!id) return '';
    return subjects.find((s) => s.id === id)?.name || '';
  }

  function getSubjectColor(id: string | null): string {
    if (!id) return '#8b9a6b';
    return subjects.find((s) => s.id === id)?.color || '#8b9a6b';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Tasks & Homework</h1>
        <div className="flex gap-2">
          <button onClick={() => setCreating('task')} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Plus size={16} /> Task
          </button>
          <button onClick={() => setCreating('homework')} className="btn-primary flex items-center gap-1.5 text-sm py-2">
            <Plus size={16} /> Homework
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 bg-charcoal-900/50 rounded-lg">
          {(['all', 'tasks', 'homework'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
                tab === t ? 'bg-charcoal-700 text-cream' : 'text-cream-dim hover:text-cream'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-charcoal-900/50 rounded-lg">
          {(['pending', 'completed', 'all'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
                statusFilter === f ? 'bg-charcoal-700 text-cream' : 'text-cream-dim hover:text-cream'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card h-16 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {(tab === 'all' || tab === 'homework') && (
            <section>
              <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">
                Homework ({statusFilter === 'pending' ? pendingHomework.length : shownHomework.length})
              </h2>
              {shownHomework.length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <BookOpen size={24} className="mx-auto text-cream-dim/40 mb-2" />
                  <p className="text-sm text-cream-dim">
                    {statusFilter === 'pending' ? 'No pending homework' : 'No homework to show'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shownHomework.map((hw) => {
                    const subjectName = getSubjectName(hw.subject_id);
                    const subjectColor = getSubjectColor(hw.subject_id);
                    const isOverdue = hw.due_date && new Date(hw.due_date) < new Date() && hw.status !== 'done';
                    return (
                      <div
                        key={hw.id}
                        className="glass-card px-4 py-3 flex items-center gap-3"
                      >
                        <button
                          onClick={() => toggleHomework(hw)}
                          className="text-cream-dim hover:text-sage-300 transition-colors shrink-0"
                        >
                          {hw.status === 'done' ? <Check size={18} className="text-sage-300" /> : <Circle size={18} />}
                        </button>
                        <button onClick={() => setEditingHomework(hw)} className="flex-1 min-w-0 text-left">
                          <p className={`text-sm font-medium text-cream truncate ${hw.status === 'done' ? 'line-through opacity-50' : ''}`}>
                            {hw.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {subjectName && (
                              <span className="text-xs flex items-center gap-1" style={{ color: subjectColor }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subjectColor }} />
                                {subjectName}
                              </span>
                            )}
                            <span className={`text-xs ${isOverdue ? 'text-accent-warm' : 'text-cream-dim'}`}>
                              Due {new Date(hw.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            {hw.topic && <span className="text-xs text-cream-dim">- {hw.topic}</span>}
                            {hw.priority >= 4 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-warm/10 text-accent-warm border border-accent-warm/15">
                                High
                              </span>
                            )}
                          </div>
                        </button>
                        {isOverdue && <AlertCircle size={16} className="text-accent-warm shrink-0" />}
                        <button onClick={() => deleteHomework(hw)} className="text-cream-dim/30 hover:text-red-400/70 transition-colors shrink-0">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {(tab === 'all' || tab === 'tasks') && (
            <section>
              <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">
                Tasks ({statusFilter === 'pending' ? pendingTasks.length : shownTasks.length})
              </h2>
              {shownTasks.length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <FileText size={24} className="mx-auto text-cream-dim/40 mb-2" />
                  <p className="text-sm text-cream-dim">
                    {statusFilter === 'pending' ? 'No pending tasks' : 'No tasks to show'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shownTasks.map((task) => {
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                    return (
                      <div key={task.id} className="glass-card px-4 py-3 flex items-center gap-3">
                        <button
                          onClick={() => toggleTask(task)}
                          className="text-cream-dim hover:text-sage-300 transition-colors shrink-0"
                        >
                          {task.status === 'done' ? <Check size={18} className="text-sage-300" /> : <Circle size={18} />}
                        </button>
                        <button onClick={() => setEditingTask(task)} className="flex-1 min-w-0 text-left">
                          <p className={`text-sm font-medium text-cream truncate ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.due_date && (
                              <span className={`text-xs ${isOverdue ? 'text-accent-warm' : 'text-cream-dim'}`}>
                                Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {task.estimated_duration_min && (
                              <span className="text-xs text-cream-dim flex items-center gap-1">
                                <Clock size={11} /> {task.estimated_duration_min}m
                              </span>
                            )}
                            {task.priority >= 4 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-warm/10 text-accent-warm border border-accent-warm/15">
                                High
                              </span>
                            )}
                          </div>
                        </button>
                        {isOverdue && <AlertCircle size={16} className="text-accent-warm shrink-0" />}
                        <button onClick={() => deleteTask(task)} className="text-cream-dim/30 hover:text-red-400/70 transition-colors shrink-0">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {statusFilter === 'all' && (completedTasks.length > 0 || completedHomework.length > 0) && (
            <section>
              <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">
                Completed
              </h2>
              <div className="space-y-2">
                {[...completedHomework.map((h) => ({ type: 'hw' as const, item: h })), ...completedTasks.map((t) => ({ type: 'task' as const, item: t }))].map(({ type, item }) => (
                  <div key={`${type}-${item.id}`} className="glass-card px-4 py-3 flex items-center gap-3 opacity-50">
                    <Check size={18} className="text-sage-300 shrink-0" />
                    <p className="text-sm text-cream-dim line-through">{item.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {(editingTask || editingHomework) && (
        <TaskEditModal
          task={editingTask}
          homework={editingHomework}
          subjects={subjects}
          onClose={() => { setEditingTask(null); setEditingHomework(null); }}
          onSaved={() => { loadData(); setEditingTask(null); setEditingHomework(null); }}
        />
      )}

      {creating && (
        <TaskCreateModal
          type={creating}
          subjects={subjects}
          onClose={() => setCreating(null)}
          onSaved={() => { loadData(); setCreating(null); }}
        />
      )}
    </div>
  );
}

function TaskCreateModal({ type, subjects, onClose, onSaved }: { type: 'task' | 'homework'; subjects: Subject[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState(3);
  const [subjectId, setSubjectId] = useState('');
  const [topic, setTopic] = useState('');
  const [estimatedMin, setEstimatedMin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (type === 'task') {
        const { error: insertError } = await supabase.from('tasks').insert({
          title: title.trim(),
          due_date: dueDate || null,
          priority,
          estimated_duration_min: estimatedMin ? parseInt(estimatedMin) : null,
        });
        if (insertError) throw insertError;
      } else {
        const { error: insertError } = await supabase.from('homework').insert({
          title: title.trim(),
          due_date: dueDate || localDateKey(),
          priority,
          subject_id: subjectId || null,
          topic: topic.trim(),
          estimated_duration_min: estimatedMin ? parseInt(estimatedMin) : null,
        });
        if (insertError) throw insertError;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-cream">New {type === 'task' ? 'Task' : 'Homework'}</h2>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="What needs to be done?" autoFocus />
          </div>
          {type === 'homework' && (
            <>
              <div>
                <label className="block text-xs text-cream-dim mb-1.5">Subject</label>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field">
                  <option value="" className="bg-charcoal-800">None</option>
                  {subjects.map((s) => <option key={s.id} value={s.id} className="bg-charcoal-800">{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-cream-dim mb-1.5">Topic</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="input-field" placeholder="e.g. Chapter 5 exercises" />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Priority</label>
              <select value={priority} onChange={(e) => setPriority(parseInt(e.target.value))} className="input-field">
                {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p} className="bg-charcoal-800">{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Estimated Duration (minutes)</label>
            <input type="number" value={estimatedMin} onChange={(e) => setEstimatedMin(e.target.value)} className="input-field" placeholder="Optional" min={5} max={480} />
          </div>
          {error && <div className="text-sm text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">{error}</div>}
          <button onClick={handleSave} disabled={!title.trim() || saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
            {saving ? 'Saving...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskEditModal({ task, homework, subjects, onClose, onSaved }: { task: Task | null; homework: Homework | null; subjects: Subject[]; onClose: () => void; onSaved: () => void }) {
  const isHomework = !!homework;
  const item = homework || task!;
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(homework?.notes || task?.description || '');
  const [dueDate, setDueDate] = useState(homework?.due_date || task?.due_date || '');
  const [priority, setPriority] = useState(item.priority);
  const [status, setStatus] = useState(item.status);
  const [subjectId, setSubjectId] = useState(homework?.subject_id || '');
  const [topic, setTopic] = useState(homework?.topic || '');
  const [estimatedMin, setEstimatedMin] = useState(String(item.estimated_duration_min || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const table = isHomework ? 'homework' : 'tasks';
    const data: Record<string, unknown> = {
      title: title.trim(),
      priority,
      status,
      estimated_duration_min: estimatedMin ? parseInt(estimatedMin) : null,
    };
    if (isHomework) {
      data.notes = description;
      data.due_date = dueDate;
      data.subject_id = subjectId || null;
      data.topic = topic.trim();
    } else {
      data.description = description;
      data.due_date = dueDate || null;
    }
    try {
      const { error: updateError } = await supabase.from(table).update(data).eq('id', item.id);
      if (updateError) throw updateError;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    setSaving(true);
    const table = isHomework ? 'homework' : 'tasks';
    const { error: deleteError } = await supabase.from(table).delete().eq('id', item.id);
    if (deleteError) { setError(deleteError.message); setSaving(false); }
    else { onSaved(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-cream">Edit {isHomework ? 'Homework' : 'Task'}</h2>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
          </div>
          {isHomework && (
            <>
              <div>
                <label className="block text-xs text-cream-dim mb-1.5">Subject</label>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field">
                  <option value="" className="bg-charcoal-800">None</option>
                  {subjects.map((s) => <option key={s.id} value={s.id} className="bg-charcoal-800">{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-cream-dim mb-1.5">Topic</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="input-field" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">{isHomework ? 'Notes' : 'Description'}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field min-h-[80px] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Priority</label>
              <select value={priority} onChange={(e) => setPriority(parseInt(e.target.value))} className="input-field">
                {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p} className="bg-charcoal-800">{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Task['status'])} className="input-field">
                <option value="todo" className="bg-charcoal-800">To Do</option>
                <option value="in_progress" className="bg-charcoal-800">In Progress</option>
                <option value="done" className="bg-charcoal-800">Done</option>
                <option value="skipped" className="bg-charcoal-800">Skipped</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Est. Duration (min)</label>
              <input type="number" value={estimatedMin} onChange={(e) => setEstimatedMin(e.target.value)} className="input-field" min={5} max={480} />
            </div>
          </div>
          {error && <div className="text-sm text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2.5 rounded-lg text-sm text-red-400/80 border border-red-500/15 hover:bg-red-500/5 transition-colors disabled:opacity-50">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
