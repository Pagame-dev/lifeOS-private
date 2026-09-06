import { useEffect, useState } from 'react';
import { Target, Plus, X, Trash2, ChevronRight, ChevronLeft, Flag, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Goal, Project, Milestone } from '@/lib/types';

export function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');

  async function loadData() {
    const [goalsRes, projectsRes, milestonesRes] = await Promise.all([
      supabase.from('goals').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('milestones').select('*').order('sort_order'),
    ]);
    setGoals((goalsRes.data as Goal[]) || []);
    setProjects((projectsRes.data as Project[]) || []);
    setMilestones((milestonesRes.data as Milestone[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createGoal() {
    if (!newTitle.trim()) return;
    await supabase.from('goals').insert({
      title: newTitle.trim(),
      description: newDescription.trim(),
      target_date: newTargetDate || null,
    });
    setNewTitle('');
    setNewDescription('');
    setNewTargetDate('');
    setCreating(false);
    loadData();
  }

  async function deleteGoal(goal: Goal) {
    await supabase.from('goals').delete().eq('id', goal.id);
    setSelectedGoal(null);
    loadData();
  }

  async function updateProgress(goal: Goal, progress: number) {
    await supabase.from('goals').update({ progress }).eq('id', goal.id);
    loadData();
  }

  if (loading) return <div className="glass-card h-96 animate-pulse" />;

  if (selectedGoal) {
    const goalProjects = projects.filter((p) => p.goal_id === selectedGoal.id);
    return (
      <GoalDetail
        goal={selectedGoal}
        projects={goalProjects}
        milestones={milestones.filter((m) => goalProjects.some((p) => p.id === m.project_id))}
        onBack={() => setSelectedGoal(null)}
        onDelete={() => deleteGoal(selectedGoal)}
        onProgressChange={(p) => updateProgress(selectedGoal, p)}
        onRefresh={loadData}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Goals</h1>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Plus size={16} /> New Goal
        </button>
      </div>

      {creating && (
        <div className="glass-card p-5 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-cream">New Goal</h2>
            <button onClick={() => setCreating(false)} className="text-cream-dim hover:text-cream"><X size={18} /></button>
          </div>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="input-field" placeholder="Goal title" autoFocus />
          <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="input-field min-h-[60px] resize-none" placeholder="Description (optional)" />
          <input type="date" value={newTargetDate} onChange={(e) => setNewTargetDate(e.target.value)} className="input-field" />
          <button onClick={createGoal} disabled={!newTitle.trim()} className="w-full btn-primary py-2.5 disabled:opacity-50">Create Goal</button>
        </div>
      )}

      {goals.length === 0 && !creating ? (
        <div className="glass-card p-12 text-center">
          <Target size={32} className="mx-auto text-cream-dim/40 mb-3" />
          <p className="text-sm text-cream-dim">No goals yet</p>
          <p className="text-xs text-cream-dim/60 mt-1">Create a goal to break it into projects and milestones</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const goalProjects = projects.filter((p) => p.goal_id === goal.id);
            return (
              <button key={goal.id} onClick={() => setSelectedGoal(goal)} className="glass-card w-full p-5 text-left hover:border-sage-500/15 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cream">{goal.title}</p>
                    {goal.description && <p className="text-xs text-cream-dim mt-1 line-clamp-2">{goal.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-cream-dim">{goalProjects.length} projects</span>
                      {goal.target_date && (
                        <span className="text-xs text-cream-dim">
                          {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-cream-dim shrink-0 mt-1" />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-cream-dim">Progress</span>
                    <span className="text-xs font-mono text-sage-300">{goal.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-sage-500/40 transition-all" style={{ width: `${goal.progress}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GoalDetail({ goal, projects, milestones, onBack, onDelete, onProgressChange, onRefresh }: {
  goal: Goal;
  projects: Project[];
  milestones: Milestone[];
  onBack: () => void;
  onDelete: () => void;
  onProgressChange: (p: number) => void;
  onRefresh: () => void;
}) {
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  async function createProject() {
    if (!newProjectTitle.trim()) return;
    await supabase.from('projects').insert({
      title: newProjectTitle.trim(),
      goal_id: goal.id,
    });
    setNewProjectTitle('');
    setCreatingProject(false);
    onRefresh();
  }

  async function deleteProject(project: Project) {
    await supabase.from('projects').delete().eq('id', project.id);
    onRefresh();
  }

  async function updateProjectProgress(project: Project, progress: number) {
    await supabase.from('projects').update({ progress }).eq('id', project.id);
    onRefresh();
  }

  async function addMilestone(projectId: string) {
    if (!newMilestoneTitle.trim()) return;
    await supabase.from('milestones').insert({
      title: newMilestoneTitle.trim(),
      project_id: projectId,
    });
    setNewMilestoneTitle('');
    onRefresh();
  }

  async function toggleMilestone(milestone: Milestone) {
    const newStatus = milestone.status === 'completed' ? 'active' : 'completed';
    await supabase.from('milestones').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', milestone.id);
    onRefresh();
  }

  async function deleteMilestone(milestone: Milestone) {
    await supabase.from('milestones').delete().eq('id', milestone.id);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-sage-300 hover:text-sage-200 flex items-center gap-1 transition-colors">
        <ChevronLeft size={16} /> Back to goals
      </button>

      <div className="glass-card p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display text-xl text-cream">{goal.title}</h2>
            {goal.description && <p className="text-sm text-cream-dim mt-1">{goal.description}</p>}
          </div>
          <button onClick={onDelete} className="text-cream-dim/40 hover:text-red-400/70 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-cream-dim">Goal Progress</span>
          <span className="text-xs font-mono text-sage-300">{goal.progress}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={goal.progress}
          onChange={(e) => onProgressChange(parseInt(e.target.value))}
          className="w-full accent-sage-500"
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-cream-dim uppercase tracking-wider">Projects ({projects.length})</h3>
        {!creatingProject && (
          <button onClick={() => setCreatingProject(true)} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      {creatingProject && (
        <div className="glass-card p-4 space-y-3 animate-slide-up">
          <input type="text" value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} className="input-field" placeholder="Project title" autoFocus />
          <div className="flex gap-2">
            <button onClick={createProject} disabled={!newProjectTitle.trim()} className="btn-primary flex-1 py-2.5 disabled:opacity-50">Add Project</button>
            <button onClick={() => setCreatingProject(false)} className="btn-ghost px-4">Cancel</button>
          </div>
        </div>
      )}

      {projects.length === 0 && !creatingProject ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-cream-dim">No projects yet</p>
          <p className="text-xs text-cream-dim/60 mt-1">Break this goal into actionable projects</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => {
            const projectMilestones = milestones.filter((m) => m.project_id === project.id);
            const isExpanded = expandedProject === project.id;
            const completedMs = projectMilestones.filter((m) => m.status === 'completed').length;
            return (
              <div key={project.id} className="glass-card overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setExpandedProject(isExpanded ? null : project.id)} className="flex-1 text-left">
                      <p className="text-sm font-medium text-cream">{project.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-cream-dim">{completedMs}/{projectMilestones.length} milestones</span>
                      </div>
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={project.progress}
                      onChange={(e) => updateProjectProgress(project, parseInt(e.target.value))}
                      className="w-24 accent-sage-500"
                    />
                    <span className="text-xs font-mono text-sage-300 w-8">{project.progress}%</span>
                    <button onClick={() => deleteProject(project)} className="text-cream-dim/30 hover:text-red-400/70 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/[0.04] p-3 space-y-2 animate-slide-up">
                    {projectMilestones.map((ms) => (
                      <div key={ms.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02]">
                        <button onClick={() => toggleMilestone(ms)} className={`w-4 h-4 rounded border transition-colors shrink-0 ${ms.status === 'completed' ? 'bg-sage-500/30 border-sage-500/40' : 'border-white/[0.1]'}`} />
                        <span className={`text-xs flex-1 ${ms.status === 'completed' ? 'text-cream-dim line-through' : 'text-cream'}`}>{ms.title}</span>
                        <button onClick={() => deleteMilestone(ms)} className="text-cream-dim/30 hover:text-red-400/70 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input type="text" value={newMilestoneTitle} onChange={(e) => setNewMilestoneTitle(e.target.value)} className="input-field flex-1 py-1.5 text-sm" placeholder="New milestone" />
                      <button onClick={() => addMilestone(project.id)} disabled={!newMilestoneTitle.trim()} className="btn-ghost px-3 text-sm disabled:opacity-50">Add</button>
                    </div>
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
