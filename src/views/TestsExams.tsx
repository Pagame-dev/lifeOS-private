import { useEffect, useState } from 'react';
import { AlertCircle, Plus, X, Trash2, Calendar, BookOpen, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TestExam, Subject } from '@/lib/types';

export function TestsExams() {
  const [tests, setTests] = useState<TestExam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TestExam | null>(null);

  async function loadData() {
    const [testsRes, subjectsRes] = await Promise.all([
      supabase.from('tests_exams').select('*').order('exam_date'),
      supabase.from('subjects').select('*').order('name'),
    ]);
    setTests((testsRes.data as TestExam[]) || []);
    setSubjects((subjectsRes.data as Subject[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function deleteTest(test: TestExam) {
    await supabase.from('tests_exams').delete().eq('id', test.id);
    loadData();
  }

  async function updateRevision(test: TestExam, progress: number) {
    await supabase.from('tests_exams').update({ revision_progress: progress }).eq('id', test.id);
    loadData();
  }

  async function markStatus(test: TestExam, status: string) {
    await supabase.from('tests_exams').update({ status }).eq('id', test.id);
    loadData();
  }

  const now = new Date();
  const upcoming = tests.filter((t) => t.status === 'upcoming' && new Date(t.exam_date) >= now);
  const past = tests.filter((t) => t.status !== 'upcoming' || new Date(t.exam_date) < now);

  function getSubjectName(id: string | null): string {
    if (!id) return '';
    return subjects.find((s) => s.id === id)?.name || '';
  }

  function getSubjectColor(id: string | null): string {
    if (!id) return '#8b9a6b';
    return subjects.find((s) => s.id === id)?.color || '#8b9a6b';
  }

  if (loading) return <div className="glass-card h-96 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Tests & Exams</h1>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Plus size={16} /> New
        </button>
      </div>

      {creating && (
        <TestEditModal
          test={null}
          subjects={subjects}
          onClose={() => setCreating(false)}
          onSaved={() => { loadData(); setCreating(false); }}
        />
      )}

      {editing && (
        <TestEditModal
          test={editing}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSaved={() => { loadData(); setEditing(null); }}
        />
      )}

      {upcoming.length === 0 && !creating ? (
        <div className="glass-card p-12 text-center">
          <AlertCircle size={32} className="mx-auto text-cream-dim/40 mb-3" />
          <p className="text-sm text-cream-dim">No upcoming tests</p>
          <p className="text-xs text-cream-dim/60 mt-1">Add a test or exam to start tracking revision</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((test) => {
            const daysUntil = Math.ceil((new Date(test.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const subjectName = getSubjectName(test.subject_id);
            const subjectColor = getSubjectColor(test.subject_id);
            const isUrgent = daysUntil <= 3;
            return (
              <div key={test.id} className="glass-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {subjectName && (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: subjectColor }} />
                      )}
                      <p className="text-sm font-medium text-cream">{test.title}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-cream-dim">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(test.exam_date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}</span>
                      {subjectName && <span className="flex items-center gap-1"><BookOpen size={11} /> {subjectName}</span>}
                      {test.importance >= 4 && <span className="text-accent-warm">High importance</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-display text-2xl ${isUrgent ? 'text-accent-warm' : 'text-sage-300'}`}>{daysUntil}d</p>
                    <p className="text-[10px] text-cream-dim">until exam</p>
                  </div>
                </div>

                {test.topics && <p className="text-xs text-cream-dim mb-3">{test.topics}</p>}

                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-cream-dim flex items-center gap-1"><TrendingUp size={11} /> Revision Progress</span>
                    <span className="text-xs font-mono text-sage-300">{test.revision_progress}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={test.revision_progress}
                    onChange={(e) => updateRevision(test, parseInt(e.target.value))}
                    className="w-full accent-sage-500"
                  />
                </div>

                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditing(test)} className="btn-ghost text-xs px-3 py-1.5">Edit</button>
                  <button onClick={() => markStatus(test, 'done')} className="btn-ghost text-xs px-3 py-1.5">Mark Done</button>
                  <button onClick={() => deleteTest(test)} className="text-xs px-3 py-1.5 text-red-400/70 border border-red-500/15 rounded-lg hover:bg-red-500/5 transition-colors ml-auto">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">Past Tests</h2>
          <div className="space-y-2">
            {past.map((test) => (
              <div key={test.id} className="glass-card px-4 py-3 flex items-center justify-between opacity-60">
                <div>
                  <p className="text-sm text-cream">{test.title}</p>
                  <p className="text-xs text-cream-dim">{new Date(test.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${test.status === 'done' ? 'bg-sage-500/10 text-sage-300' : 'bg-white/[0.04] text-cream-dim'}`}>
                  {test.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TestEditModal({ test, subjects, onClose, onSaved }: { test: TestExam | null; subjects: Subject[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(test?.title || '');
  const [examDate, setExamDate] = useState(test?.exam_date || '');
  const [importance, setImportance] = useState(test?.importance || 3);
  const [subjectId, setSubjectId] = useState(test?.subject_id || '');
  const [topics, setTopics] = useState(test?.topics || '');
  const [notes, setNotes] = useState(test?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !examDate) return;
    setSaving(true);
    setError(null);
    const data = {
      title: title.trim(),
      exam_date: examDate,
      importance,
      subject_id: subjectId || null,
      topics: topics.trim(),
      notes: notes.trim(),
    };
    try {
      const result = test
        ? await supabase.from('tests_exams').update(data).eq('id', test.id)
        : await supabase.from('tests_exams').insert({ ...data, status: 'upcoming' });
      if (result.error) throw result.error;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-cream">{test ? 'Edit Test' : 'New Test'}</h2>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="e.g. Math Midterm" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Exam Date</label>
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Importance</label>
              <select value={importance} onChange={(e) => setImportance(parseInt(e.target.value))} className="input-field">
                {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p} className="bg-charcoal-800">{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Subject</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field">
              <option value="" className="bg-charcoal-800">None</option>
              {subjects.map((s) => <option key={s.id} value={s.id} className="bg-charcoal-800">{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Topics</label>
            <input type="text" value={topics} onChange={(e) => setTopics(e.target.value)} className="input-field" placeholder="e.g. Chapters 1-5, Algebra" />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field min-h-[60px] resize-none" placeholder="Additional notes" />
          </div>
          {error && <div className="text-sm text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">{error}</div>}
          <button onClick={handleSave} disabled={!title.trim() || !examDate || saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
