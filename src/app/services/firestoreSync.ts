/**
 * Online synchronizace přes Supabase (bez přihlašování).
 * Každý, kdo má odkaz, čte i zapisuje stejná data v reálném čase.
 */
import { supabase } from "@/integrations/supabase/client";
import { Operator, MoveHistoryRecord, ShiftTemplate, Department } from "../types";

export type Unsubscribe = () => void;

const OPERATORS = "operators";
const HISTORY = "move_history";
const TEMPLATES = "shift_templates";
const CUSTOM_DEPTS = "custom_departments";

// ---------- mapování řádků ----------

function rowToOperator(data: Record<string, unknown>): Operator {
  return {
    id: String(data["id"] || ""),
    name: String(data["name"] || ""),
    machineType: (data["machine_type"] || "NONE") as Operator["machineType"],
    departmentId: String(data["department_id"] || "unassigned"),
    isVnaOnly: Boolean(data["is_vna_only"]),
    status: (data["status"] || "active") as Operator["status"],
    shift: (data["shift"] || "A") as Operator["shift"],
    absenceReason:
      (data["absence_reason"] as Operator["absenceReason"]) ||
      (data["department_id"] === "unassigned" ? "Absence" : undefined),
    notes: (data["notes"] as string) || undefined,
    lastMovedAt: String(data["last_moved_at"] || new Date().toISOString()),
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
    shift: op.shift || "A",
    absence_reason: op.absenceReason || null,
    notes: op.notes ? op.notes.slice(0, 500) : null,
    last_moved_at: op.lastMovedAt || new Date().toISOString(),
  };
}

function rowToHistory(data: Record<string, unknown>): MoveHistoryRecord {
  return {
    id: String(data["id"] || ""),
    operatorId: String(data["operator_id"] || ""),
    operatorName: String(data["operator_name"] || ""),
    machineType: (data["machine_type"] || "NONE") as MoveHistoryRecord["machineType"],
    fromDept: String(data["from_dept"] || ""),
    toDept: String(data["to_dept"] || ""),
    timestamp: String(data["timestamp"] || ""),
    shift: (data["shift"] as MoveHistoryRecord["shift"]) || undefined,
    reason: (data["reason"] as string) || undefined,
  };
}

function rowToTemplate(data: Record<string, unknown>): ShiftTemplate {
  return {
    id: String(data["id"] || ""),
    name: String(data["name"] || ""),
    description: (data["description"] as string) || undefined,
    createdAt: String(data["created_at"] || ""),
    isBuiltIn: Boolean(data["is_built_in"]),
    shift: (data["shift"] as ShiftTemplate["shift"]) || "A",
    operatorCount: Number(data["operator_count"] || 0),
    activeCount: Number(data["active_count"] || 0),
    assignments: Array.isArray(data["assignments"]) ? data["assignments"] : [],
  };
}

function rowToDepartment(data: Record<string, unknown>): Department {
  return {
    id: String(data["id"] || ""),
    name: String(data["name"] || ""),
    fullName: String(data["full_name"] || `Vícepráce: ${data["name"]}`),
    code: String(data["code"] || "VÍCE"),
    description: String(data["description"] || ""),
    color: String(data["color"] || "amber"),
    badgeBg: String(
      data["badge_bg"] ||
        "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    ),
    badgeText: String(data["badge_text"] || "text-amber-700 dark:text-amber-400"),
    borderColor: String(data["border_color"] || "border-amber-400 dark:border-amber-600"),
    iconName: String(data["icon_name"] || "Wrench"),
    targetCount: typeof data["target_count"] === "number" ? data["target_count"] : 0,
    isCustom: true,
    shift: (data["shift"] as Department["shift"]) || "A",
    createdAt: String(data["created_at"] || new Date().toISOString()),
  };
}

// ---------- obecný odběr ----------

function subscribeTable<T>(
  table: string,
  fetcher: () => Promise<T[]>,
  onUpdate: (items: T[]) => void,
  onError?: (err: Error) => void,
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
    .on("postgres_changes", { event: "*", schema: "public", table }, () => {
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
  onError?: (err: Error) => void,
): Unsubscribe {
  return subscribeTable<Operator>(
    OPERATORS,
    async () => {
      const { data, error } = await supabase.from(OPERATORS).select("*").limit(2000);
      if (error) throw error;
      return (data || []).map(rowToOperator);
    },
    onUpdate,
    onError,
  );
}

export async function syncOperatorToCloud(operator: Operator): Promise<void> {
  const { error } = await supabase.from(OPERATORS).upsert(operatorToRow(operator));
  if (error) console.warn("Nepodařilo se uložit operátora online:", error.message);
}

export async function deleteOperatorFromCloud(operatorId: string): Promise<void> {
  const { error } = await supabase.from(OPERATORS).delete().eq("id", operatorId);
  if (error) console.warn("Nepodařilo se smazat operátora online:", error.message);
}

export async function bulkSyncOperatorsToCloud(operators: Operator[]): Promise<void> {
  for (let i = 0; i < operators.length; i += 200) {
    const chunk = operators.slice(i, i + 200).map(operatorToRow);
    const { error } = await supabase.from(OPERATORS).upsert(chunk);
    if (error) {
      console.warn("Hromadné uložení operátorů selhalo:", error.message);
      return;
    }
  }
}

// ---------- Historie ----------

export function subscribeToHistory(
  onUpdate: (history: MoveHistoryRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return subscribeTable<MoveHistoryRecord>(
    HISTORY,
    async () => {
      const { data, error } = await supabase
        .from(HISTORY)
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map(rowToHistory);
    },
    onUpdate,
    onError,
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
  if (error) console.warn("Nepodařilo se uložit záznam historie online:", error.message);
}

// ---------- Šablony ----------

export function subscribeToTemplates(
  onUpdate: (templates: ShiftTemplate[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return subscribeTable<ShiftTemplate>(
    TEMPLATES,
    async () => {
      const { data, error } = await supabase
        .from(TEMPLATES)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map(rowToTemplate);
    },
    onUpdate,
    onError,
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
    shift: template.shift || "A",
    assignments: template.assignments as unknown as Array<Record<string, unknown>>,
    created_at: template.createdAt,
  });
  if (error) console.warn("Nepodařilo se uložit šablonu online:", error.message);
}

export async function deleteTemplateFromCloud(templateId: string): Promise<void> {
  const { error } = await supabase.from(TEMPLATES).delete().eq("id", templateId);
  if (error) console.warn("Nepodařilo se smazat šablonu online:", error.message);
}

// ---------- Vlastní oddělení (Vícepráce) ----------

export function subscribeToCustomDepartments(
  onUpdate: (depts: Department[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return subscribeTable<Department>(
    CUSTOM_DEPTS,
    async () => {
      const { data, error } = await supabase
        .from(CUSTOM_DEPTS)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map(rowToDepartment);
    },
    onUpdate,
    onError,
  );
}

export async function syncCustomDepartmentToCloud(dept: Department): Promise<void> {
  const { error } = await supabase.from(CUSTOM_DEPTS).upsert({
    id: dept.id,
    name: dept.name.slice(0, 100),
    full_name: (dept.fullName || `Vícepráce: ${dept.name}`).slice(0, 120),
    code: (dept.code || "VÍCE").slice(0, 20),
    description: (dept.description || "").slice(0, 500),
    color: dept.color || "amber",
    badge_bg: dept.badgeBg,
    badge_text: dept.badgeText,
    border_color: dept.borderColor,
    icon_name: dept.iconName || "Wrench",
    target_count: dept.targetCount || 0,
    shift: dept.shift || "A",
    created_at: dept.createdAt || new Date().toISOString(),
  });
  if (error) console.warn("Nepodařilo se uložit oddělení online:", error.message);
}

export async function deleteCustomDepartmentFromCloud(deptId: string): Promise<void> {
  const { error } = await supabase.from(CUSTOM_DEPTS).delete().eq("id", deptId);
  if (error) console.warn("Nepodařilo se smazat oddělení online:", error.message);
}
