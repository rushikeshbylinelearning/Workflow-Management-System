export type TimelineItemType = 'milestone' | 'stage' | 'task';

export interface ProjectTimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  date: Date;
  endDate?: Date;
  status: string;
  description?: string;
  progress?: number;
  priority?: string;
  assignees?: any[];
  weight?: number;
}

export function parseTimelineDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getTaskStageId(task: any): number | null {
  const raw = task.category_stage_id ?? task.stage_id ?? task.stageId;
  if (raw == null || raw === '') return null;
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

export function getTasksForStage(stageId: number | string, tasks: any[]): any[] {
  const id = Number(stageId);
  return tasks.filter((task) => getTaskStageId(task) === id);
}

export function deriveStageStatus(stageTasks: any[]): string {
  if (stageTasks.length === 0) return 'not-started';

  const completed = stageTasks.filter((task) => task.status === 'completed').length;
  if (completed === stageTasks.length) return 'completed';

  const hasActiveWork = stageTasks.some((task) =>
    ['in-progress', 'under-review', 'resubmitted', 'blocked', 'returned', 'redo-requested'].includes(task.status)
  );

  if (hasActiveWork || completed > 0) return 'in-progress';
  return 'not-started';
}

export function deriveStageProgress(stageTasks: any[]): number {
  if (stageTasks.length === 0) return 0;
  const completed = stageTasks.filter((task) => task.status === 'completed').length;
  return Math.round((completed / stageTasks.length) * 100);
}

export function deriveDateRangeFromTasks(tasks: any[]): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;

  for (const task of tasks) {
    const taskStart = parseTimelineDate(task.start_date || task.startDate);
    const taskEnd = parseTimelineDate(task.end_date || task.endDate);

    if (taskStart && (!start || taskStart < start)) start = taskStart;
    if (taskEnd && (!end || taskEnd > end)) end = taskEnd;
  }

  return { start, end };
}

function distributeStageDates(
  stageIndex: number,
  stageCount: number,
  projectStart: Date,
  projectEnd: Date
): { start: Date; end: Date } {
  const totalMs = Math.max(projectEnd.getTime() - projectStart.getTime(), 1);
  const slice = totalMs / stageCount;
  return {
    start: new Date(projectStart.getTime() + slice * stageIndex),
    end: new Date(projectStart.getTime() + slice * (stageIndex + 1)),
  };
}

export function buildProjectTimelineItems(params: {
  project: any;
  stages: any[];
  tasks: any[];
}): ProjectTimelineItem[] {
  const { project, stages, tasks } = params;
  const items: ProjectTimelineItem[] = [];

  const projectStart = parseTimelineDate(project.start_date || project.startDate);
  const projectEnd = parseTimelineDate(project.end_date || project.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasStarted =
    Boolean(projectStart && projectStart <= today) ||
    tasks.some((task) => task.status && task.status !== 'not-started');

  items.push({
    id: 'project-start',
    type: 'milestone',
    title: 'Project Start',
    date: projectStart || today,
    status: hasStarted ? 'completed' : 'not-started',
    description: 'Project officially started',
  });

  const sortedStages = [...stages].sort(
    (a, b) => (a.template_order ?? a.order_index ?? 0) - (b.template_order ?? b.order_index ?? 0)
  );

  sortedStages.forEach((stage, index) => {
    const stageTasks = getTasksForStage(stage.id, tasks);
    const status = deriveStageStatus(stageTasks);
    const progress = deriveStageProgress(stageTasks);
    const { start, end } = deriveDateRangeFromTasks(stageTasks);

    let date = start;
    let endDate = end;

    if ((!date || !endDate) && projectStart && projectEnd && sortedStages.length > 0) {
      const distributed = distributeStageDates(index, sortedStages.length, projectStart, projectEnd);
      date = date || distributed.start;
      endDate = endDate || distributed.end;
    }

    items.push({
      id: `stage-${stage.id}`,
      type: 'stage',
      title: stage.name,
      date: date || projectStart || today,
      endDate: endDate || undefined,
      status,
      progress,
      description:
        stage.description ||
        `${stageTasks.filter((task) => task.assignees?.length).length} assigned · ${stageTasks.length} total task${stageTasks.length !== 1 ? 's' : ''}`,
      weight: stage.weight,
    });
  });

  const assignedTasks = tasks.filter(
    (task) =>
      Array.isArray(task.assignees) &&
      task.assignees.length > 0 &&
      (task.status !== 'completed' || task.priority === 'high' || task.priority === 'urgent')
  );

  assignedTasks.forEach((task) => {
    const start = parseTimelineDate(task.start_date || task.startDate);
    const end = parseTimelineDate(task.end_date || task.endDate);

    items.push({
      id: `task-${task.id}`,
      type: 'task',
      title: task.name,
      date: start || end || projectStart || today,
      endDate: end || undefined,
      status: task.status || 'not-started',
      progress: Number(task.progress) || 0,
      description: task.description,
      priority: task.priority,
      assignees: task.assignees,
    });
  });

  const allTasksCompleted = tasks.length > 0 && tasks.every((task) => task.status === 'completed');
  const incompleteTasks = tasks.filter((task) => task.status !== 'completed');
  const { end: projectedEnd } = deriveDateRangeFromTasks(incompleteTasks.length > 0 ? incompleteTasks : tasks);

  const completionStatus =
    project.status === 'completed' || allTasksCompleted || Number(project.progress) >= 100
      ? 'completed'
      : 'pending';

  const completionDate = projectedEnd || projectEnd || today;
  const completionDescription =
    completionStatus === 'completed'
      ? 'All assigned project tasks are complete'
      : projectedEnd
        ? `Target completion based on open task deadlines (${projectedEnd.toLocaleDateString()})`
        : 'Planned project completion date';

  items.push({
    id: 'project-end',
    type: 'milestone',
    title: 'Project Completion',
    date: completionDate,
    status: completionStatus,
    description: completionDescription,
  });

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function isTimelineItemOverdue(item: ProjectTimelineItem): boolean {
  if (item.type === 'milestone') return false;
  if (item.status === 'completed') return false;

  const endDate = item.endDate || item.date;
  if (!endDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(endDate);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
}

export function countTimelineItemsInProgress(items: ProjectTimelineItem[]): number {
  return items.filter((item) =>
    ['in-progress', 'under-review', 'resubmitted', 'blocked', 'returned', 'redo-requested'].includes(item.status)
  ).length;
}
