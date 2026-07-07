import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, radius, font } from '../theme';

type Task = {
  id: number;
  title: string;
  date: string; // "YYYY-MM-DD"
  priority: 'low' | 'medium' | 'high';
  category: 'Trading' | 'Research' | 'Personal' | 'Reminder';
  done: boolean;
};

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const PRIORITIES: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
const CATEGORIES: Array<Task['category']> = ['Trading', 'Research', 'Personal', 'Reminder'];

function toDateString(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function priorityColor(priority: string): string {
  if (priority === 'high') return colors.red;
  if (priority === 'medium') return colors.accent;
  return colors.textMuted;
}

let nextId = 1;

export default function CalendarScreen({ navigation }: { navigation: any }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newCategory, setNewCategory] = useState<Task['category']>('Trading');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Convert Sunday-based firstWeekday to Monday-based (0=Mon ... 6=Sun)
  const rawFirstWeekday = new Date(year, month, 1).getDay();
  const firstWeekday = (rawFirstWeekday + 6) % 7;

  useEffect(() => {
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === month) {
      setSelectedDay(today.getDate());
    } else {
      setSelectedDay(1);
    }
  }, [year, month]);

  const goToPrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const selectedDateStr = selectedDay ? toDateString(year, month, selectedDay) : null;

  const tasksForSelected = (Array.isArray(tasks) ? tasks : []).filter(
    (t) => t.date === selectedDateStr,
  );

  const daysWithTasks = new Set(
    (Array.isArray(tasks) ? tasks : [])
      .filter((t) => {
        const [ty, tm] = t.date.split('-').map(Number);
        return ty === year && tm === month + 1;
      })
      .map((t) => Number(t.date.split('-')[2])),
  );

  const handleAddTask = () => {
    if (!newTitle.trim() || !selectedDateStr) return;
    const task: Task = {
      id: nextId++,
      title: newTitle.trim(),
      date: selectedDateStr,
      priority: newPriority,
      category: newCategory,
      done: false,
    };
    setTasks((prev) => [...prev, task]);
    setNewTitle('');
    setNewPriority('medium');
    setNewCategory('Trading');
  };

  const handleToggleDone = (id: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const handleDeleteTask = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const today = new Date();
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  // Build grid cells: leading empty + day numbers
  const gridCells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedLabel = selectedDateStr
    ? `TASKS FOR ${selectedDateStr}`
    : 'SELECT A DATE';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
        <Text style={styles.headerMonth}>
          {MONTH_NAMES[month]} {year}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthNavBtn} onPress={goToPrevMonth}>
            <Text style={styles.monthNavBtnText}>‹ PREV</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[month]} {year}
          </Text>
          <TouchableOpacity style={styles.monthNavBtn} onPress={goToNextMonth}>
            <Text style={styles.monthNavBtnText}>NEXT ›</Text>
          </TouchableOpacity>
        </View>

        {/* Weekday Labels */}
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((d) => (
            <View key={d} style={styles.weekdayCell}>
              <Text style={styles.weekdayLabel}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Day Grid */}
        <View style={styles.grid}>
          {gridCells.map((day, idx) => {
            if (day === null) {
              return <View key={`empty-${idx}`} style={styles.gridCell} />;
            }
            const isToday = day === todayDay;
            const isSelected = day === selectedDay;
            const hasTasks = daysWithTasks.has(day);

            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.gridCell,
                  isToday && styles.gridCellToday,
                  !isToday && isSelected && styles.gridCellSelected,
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    isToday && styles.dayNumberToday,
                    !isToday && isSelected && styles.dayNumberSelected,
                  ]}
                >
                  {day}
                </Text>
                {hasTasks && (
                  <View style={[styles.taskDot, isToday && styles.taskDotToday]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tasks Section */}
        {selectedDateStr && (
          <View style={styles.tasksSection}>
            <Text style={styles.tasksSectionHeader}>{selectedLabel}</Text>

            {/* Add task row */}
            <View style={styles.addTaskRow}>
              <TextInput
                style={styles.addTaskInput}
                placeholder="Add a task…"
                placeholderTextColor={colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
                onSubmitEditing={handleAddTask}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addTaskBtn, !newTitle.trim() && styles.addTaskBtnDisabled]}
                onPress={handleAddTask}
                disabled={!newTitle.trim()}
              >
                <Text style={styles.addTaskBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Priority & Category pickers */}
            {newTitle.trim().length > 0 && (
              <View style={styles.formCard}>
                <Text style={styles.formLabel}>Priority</Text>
                <View style={styles.chipsRow}>
                  {PRIORITIES.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.chip,
                        newPriority === p && { backgroundColor: priorityColor(p), borderColor: priorityColor(p) },
                      ]}
                      onPress={() => setNewPriority(p)}
                    >
                      <Text style={[styles.chipText, newPriority === p && styles.chipTextActive]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.chipsRow}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, newCategory === c && styles.chipActive]}
                      onPress={() => setNewCategory(c)}
                    >
                      <Text style={[styles.chipText, newCategory === c && styles.chipTextActive]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Task Rows */}
            {tasksForSelected.length === 0 ? (
              <View style={styles.emptyTasks}>
                <Text style={styles.emptyTasksText}>No tasks for this day</Text>
              </View>
            ) : (
              tasksForSelected.map((task) => (
                <View key={task.id} style={styles.taskRow}>
                  <TouchableOpacity
                    style={[styles.checkbox, task.done && styles.checkboxDone]}
                    onPress={() => handleToggleDone(task.id)}
                  >
                    {task.done && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    <Text style={styles.taskMeta}>{task.category}</Text>
                  </View>
                  <View style={[styles.priorityDot, { backgroundColor: priorityColor(task.priority) }]} />
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteTask(task.id)}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const CELL_SIZE = 46;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  headerMonth: {
    fontSize: font.sm,
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  monthNavBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  monthNavBtnText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  monthLabel: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
  },
  // Weekday labels
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  weekdayLabel: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '600',
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  gridCell: {
    width: `${100 / 7}%`,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  gridCellToday: {
    backgroundColor: colors.accent,
    borderRadius: 10,
  },
  gridCellSelected: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 10,
  },
  dayNumber: {
    fontSize: font.sm,
    fontWeight: '500',
    color: colors.text,
  },
  dayNumberToday: {
    color: '#000',
    fontWeight: '700',
  },
  dayNumberSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  taskDotToday: {
    backgroundColor: '#000',
  },
  // Tasks section
  tasksSection: {
    marginTop: spacing.xs,
  },
  tasksSectionHeader: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  addTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  addTaskInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.sm,
    color: colors.text,
  },
  addTaskBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTaskBtnDisabled: {
    opacity: 0.4,
  },
  addTaskBtnText: {
    fontSize: font.xl,
    fontWeight: '700',
    color: '#000',
    lineHeight: 28,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  formLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#000',
  },
  // Task rows
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  checkmark: {
    fontSize: font.xs,
    fontWeight: '700',
    color: '#fff',
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  taskMeta: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  deleteBtnText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  emptyTasks: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyTasksText: {
    fontSize: font.sm,
    color: colors.textMuted,
  },
});
