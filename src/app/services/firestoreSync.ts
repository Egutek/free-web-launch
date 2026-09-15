/**
 * Online synchronizace přes Supabase (bez přihlašování).
 * Každý, kdo má odkaz, čte i zapisuje stejná data v reálném čase.
 */
import { supabase } from '@/integrations/supabase/client';
import { Operator, MoveHistoryRecord, ShiftTemplate, Department } from '../types';

export type Unsubscribe = () => void;

const OPERATORS = 'operators';
const HISTORY = 'move_history';
const TEMPLATES = 'shift_templates';
const CUSTOM_DEPTS = 'custom_departments';

// ---------- mapování řádků ----------

function rowToOperator(data: any): Operator {
  return {
    id: data.id,
    name: data.name || '',
    machineType: data.machine_type || 'NONE',
    departmentId: data.department_id || 'unassigned',
    isVnaOnly: Boolean(data.is_vna_only),
    status: data.status || 'active',
    shift: data.shift || 'A',
    absenceReason:
      data.absence_reason || (data.department_id === 'unassigned' ? 'Absence' : undefined),
    notes: data.notes || undefined,
    lastMovedAt: data.last_moved_at || new Date().toISOString(),
  };
}

function operatorToRow(op: Operator) {
  return {
    id: op.id,
    name: op.name.slice(0, 100),
    machine_type: op.machineType,
    department_id: op.departmentId,
    is_vna_only: Boolean(op.isVnaOnly),
    status: op.status,
    shift: op.shift || 'A',
    absence_reason: op.absenceReason || null,
    notes: op.notes ? op.notes.slice(0, 500) : null,
    last_moved_at: op.lastMovedAt || new Date().toISOString(),
  };
}

function rowToHistory(data: any): MoveHistoryRecord {
  return {
    id: data.id,
    operatorId: data.operator_id,
    operatorName: data.operator_name,
    machineType: data.machine_type,
    fromDept: data.from_dept,
    toDept: data.to_dept,
    timestamp: data.timestamp,
    shift: data.shift || undefined,
    reason: data.reason || undefined,
  };
}

function rowToTemplate(data: any): ShiftTemplate {
  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    createdAt: data.created_at,
    isBuiltIn: Boolean(data.is_built_in),
    shift: data.shift || 'A',
    operatorCount: Number(data.operator_count || 0),
    activeCount: Number(data.active_count || 0),
    assignments: Array.isArray(data.assignments) ? data.assignments : [],
  };
}

function rowToDepartment(data: any): Department {
  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name || `Vícepráce: ${data.name}`,
    code: data.code || 'VÍCE',
    description: data.description || '',
    color: data.color || 'amber',
    badgeBg:
      data.badge_bg ||
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    badgeText: data.badge_text || 'text-amber-700 dark:text-amber-400',
    borderColor: data.border_color || 'border-amber-400 dark:border-amber-600',
    iconName: data.icon_name || 'Wrench',
    targetCount: typeof data.target_count === 'number' ? data.target_count : 0,
    isCustom: true,
    shift: data.shift || 'A',
    createdAt: data.created_at || new Date().toISOString(),
  };
}

// ---------- obecný odběr ----------

function subscribeTable<T>(
  table: string,
  fetcher: () => Promise<T[]>,
  onUpdate: (items: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let stopped = false;

  const load = async () => {
    try {
      const items = await fetcher();
      if (!stopped) onUpdate(items);
    } catch (err) {
      console.warn(`Nepodařilo se načíst ${table}:`, err);
      if (onError) onError(err as Error);
    }
  };

  void load();

  const channel = supabase
    .channel(`realtime-${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      void load();
    })
    .subscribe();

  return () => {
    stopped = true;
    void supabase.removeChannel(channel);
  };
}

// ---------- Operátoři ----------

export function subscribeToOperators(
  onUpdate: (operators: Operator[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeTable<Operator>(
    OPERATORS,
    async () => {
      const { data, error } = await supabase.from(OPERATORS).select('*').limit(2000);
      if (error) throw error;
      return (data || []).map(rowToOperator);
    },
    onUpdate,
    onError
  );
}

export async function syncOperatorToCloud(operator: Operator): Promise<void> {
  const { error } = await supabase.from(OPERATORS).upsert(operatorToRow(operator));
  if (error) console.warn('Nepodařilo se uložit operátora online:', error.message);
}

export async function deleteOperatorFromCloud(operatorId: string): Promise<void> {
  const { error } = await supabase.from(OPERATORS).delete().eq('id', operatorId);
  if (error) console.warn('Nepodařilo se smazat operátora online:', error.message);
}

export async function bulkSyncOperatorsToCloud(operators: Operator[]): Promise<void> {
  for (let i = 0; i < operators.length; i += 200) {
    const chunk = operators.slice(i, i + 200).map(operatorToRow);
    const { error } = await supabase.from(OPERATORS).upsert(chunk);
    if (error) {
      console.warn('Hromadné uložení operátorů selhalo:', error.message);
      return;
    }
  }
}

// ---------- Historie ----------

export function subscribeToHistory(
  onUpdate: (history: MoveHistoryRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeTable<MoveHistoryRecord>(
    HISTORY,
    async () => {
      const { data, error } = await supabase
        .from(HISTORY)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map(rowToHistory);
    },
    onUpdate,
    onError
  );
}

export async function syncHistoryRecordToCloud(record: MoveHistoryRecord): Promise<void> {
  const { error } = await supabase.from(HISTORY).upsert({
    id: record.id,
    operator_id: record.operatorId.slice(0, 128),
    operator_name: record.operatorName.slice(0, 100),
    machine_type: record.machineType,
    from_dept: record.fromDept,
    to_dept: record.toDept,
    timestamp: record.timestamp,
    shift: record.shift || null,
    reason: record.reason ? record.reason.slice(0, 300) : null,
  });
  if (error) console.warn('Nepodařilo se uložit záznam historie online:', error.message);
}

// ---------- Šablony ----------

export function subscribeToTemplates(
  onUpdate: (templates: ShiftTemplate[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeTable<ShiftTemplate>(
    TEMPLATES,
    async () => {
      const { data, error } = await supabase
        .from(TEMPLATES)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map(rowToTemplate);
    },
    onUpdate,
    onError
  );
}

export async function syncTemplateToCloud(template: ShiftTemplate): Promise<void> {
  const { error } = await supabase.from(TEMPLATES).upsert({
    id: template.id,
    name: template.name.slice(0, 120),
    description: template.description ? template.description.slice(0, 500) : null,
    is_built_in: Boolean(template.isBuiltIn),
    operator_count: template.operatorCount,
    active_count: template.activeCount,
    shift: template.shift || 'A',
    assignments: template.assignments as unknown as any,
    created_at: template.createdAt,
  });
  if (error) console.warn('Nepodařilo se uložit šablonu online:', error.message);
}

export async function deleteTemplateFromCloud(templateId: string): Promise<void> {
  const { error } = await supabase.from(TEMPLATES).delete().eq('id', templateId);
  if (error) console.warn('Nepodařilo se smazat šablonu online:', error.message);
}

// ---------- Vlastní oddělení (Vícepráce) ----------

export function subscribeToCustomDepartments(
  onUpdate: (depts: Department[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeTable<Department>(
    CUSTOM_DEPTS,
    async () => {
      const { data, error } = await supabase
        .from(CUSTOM_DEPTS)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map(rowToDepartment);
    },
    onUpdate,
    onError
  );
}

export async function syncCustomDepartmentToCloud(dept: Department): Promise<void> {
  const { error } = await supabase.from(CUSTOM_DEPTS).upsert({
    id: dept.id,
    name: dept.name.slice(0, 100),
    full_name: (dept.fullName || `Vícepráce: ${dept.name}`).slice(0, 120),
    code: (dept.code || 'VÍCE').slice(0, 20),
    description: (dept.description || '').slice(0, 500),
    color: dept.color || 'amber',
    badge_bg: dept.badgeBg,
    badge_text: dept.badgeText,
    border_color: dept.borderColor,
    icon_name: dept.iconName || 'Wrench',
    target_count: dept.targetCount || 0,
    shift: dept.shift || 'A',
    created_at: dept.createdAt || new Date().toISOString(),
  });
  if (error) console.warn('Nepodařilo se uložit oddělení online:', error.message);
}

export async function deleteCustomDepartmentFromCloud(deptId: string): Promise<void> {
  const { error } = await supabase.from(CUSTOM_DEPTS).delete().eq('id', deptId);
  if (error) console.warn('Nepodařilo se smazat oddělení online:', error.message);
}
