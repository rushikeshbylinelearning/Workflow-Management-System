/** Collect assignee IDs from a task (supports both API shapes). */
export function getTaskAssigneeIds(task: any): string[] {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) {
    return task.assignees.map((id: any) => String(id));
  }
  if (Array.isArray(task?.assigneeDetails) && task.assigneeDetails.length > 0) {
    return task.assigneeDetails.map((a: any) => String(a.id));
  }
  return [];
}

export function taskHasAssignee(task: any, userId: string | number): boolean {
  return getTaskAssigneeIds(task).includes(String(userId));
}

export function isTaskOverdue(task: any): boolean {
  if (!task?.end_date || task.status === 'completed' || task.status === 'skipped') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.end_date);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

/** Match a skill on a member (API returns skill names as strings). */
export function memberHasSkill(member: any, skill: { id: number | string; name: string }): boolean {
  if (!Array.isArray(member?.skills) || member.skills.length === 0) return false;
  const skillId = String(skill.id);
  const skillName = skill.name?.toLowerCase().trim();
  return member.skills.some((s: any) => {
    if (typeof s === 'object' && s !== null) {
      return String(s.id) === skillId || s.name?.toLowerCase().trim() === skillName;
    }
    const ref = String(s).toLowerCase().trim();
    return ref === skillId || ref === skillName;
  });
}

/** Match a skill on a task (API returns full skill objects in task.skills). */
export function taskHasSkill(task: any, skill: { id: number | string; name: string }): boolean {
  if (Array.isArray(task?.skills) && task.skills.length > 0) {
    const skillId = Number(skill.id);
    const skillName = skill.name?.toLowerCase().trim();
    return task.skills.some((s: any) => {
      if (typeof s === 'object' && s !== null) {
        return Number(s.id) === skillId || s.name?.toLowerCase().trim() === skillName;
      }
      const n = Number(s);
      if (!Number.isNaN(n) && n === skillId) return true;
      return String(s).toLowerCase().trim() === skillName;
    });
  }
  return false;
}

/** Tasks linked to a skill via task_skills or assignee skills. */
export function getTasksForSkill(
  tasks: any[],
  skill: { id: number | string; name: string },
  teamMembers: any[]
): any[] {
  const direct = tasks.filter((t) => taskHasSkill(t, skill));
  if (direct.length > 0) return direct;

  return tasks.filter((t) => {
    const assigneeIds = getTaskAssigneeIds(t);
    return assigneeIds.some((aid) => {
      const member = teamMembers.find((u) => String(u.id) === aid);
      return member && memberHasSkill(member, skill);
    });
  });
}
