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

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newCategory, setNewCategory] = useState<Task['category']>('Trading');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  // Select today's day on mount / month change
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

  const selectedDateStr = selectedDay
    ? toDateString(year, month, selectedDay)
    : null;

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
    setShowForm(false);
  };

  const handleToggleDone = (id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  };

  const handleDeleteTask = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Build grid cells: leading empty + day numbers
  const gridCells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthNavBtn} onPress={goToPrevMonth}>
            <Text style={styles.monthNavBtnText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[month]} {year}
          </Text>
          <TouchableOpacity style={styles.monthNavBtn} onPress={goToNextMonth}>
            <Text style={styles.monthNavBtnText}>{'>'}</Text>
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
            const isSelected = day === selectedDay;
            const hasTasks = daysWithTasks.has(day);
            return (
              <TouchableOpacity
                key={day}
                style={[styles.gridCell, isSelected && styles.gridCellSelected]}
                onPress={() => setSelectedDay(day)}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    isSelected && styles.dayNumberSelected,
                  ]}
                >
                  {day}
                </Text>
                {hasTasks && (
                  <View
                    style={[
                      styles.taskDot,
                      isSelected && styles.taskDotSelected,
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Date Tasks */}
        {selectedDateStr && (
          <View style={styles.tasksSection}>
            <View style={styles.tasksSectionHeader}>
              <Text style={styles.tasksSectionTitle}>
                Tasks — {selectedDateStr}
              </Text>
              <TouchableOpacity
                style={styles.addTaskBtn}
                onPress={() => setShowForm((v) => !v)}
              >
                <Text style={styles.addTaskBtnText}>
                  {showForm ? 'Cancel' : '+ Add Task'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Add Task Form */}
            {showForm && (
              <View style={styles.formCard}>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Task title…"
                  placeholderTextColor={colors.textMuted}
                  value={newTitle}
                  onChangeText={setNewTitle}
                />

                <Text style={styles.formLabel}>Priority</Text>
                <View style={styles.chipsRow}>
                  {PRIORITIES.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.chip,
                        newPriority === p && {
                          backgroundColor: priorityColor(p),
                          borderColor: priorityColor(p),
                        },
                      ]}
                      onPress={() => setNewPriority(p)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          newPriority === p && styles.chipTextActive,
                        ]}
                      >
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
                      style={[
                        styles.chip,
                        newCategory === c && styles.chipActive,
                      ]}
                      onPress={() => setNewCategory(c)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          newCategory === c && styles.chipTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    !newTitle.trim() && styles.submitBtnDisabled,
                  ]}
                  onPress={handleAddTask}
                  disabled={!newTitle.trim()}
                >
                  <Text style={styles.submitBtnText}>Add Task</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Task Rows */}
            {tasksForSelected.length === 0 && !showForm ? (
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
                    <Text
                      style={[styles.taskTitle, task.done && styles.taskTitleDone]}
                    >
                      {task.title}
                    </Text>
                    <Text style={styles.taskMeta}>
                      {task.category}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: priorityColor(task.priority) },
                    ]}
                  />
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

const CELL_SIZE = 44;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavBtnText: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
  },
  monthLabel: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
  },
  // Weekday labels
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  weekdayLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textMuted,
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
  },
  gridCellSelected: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
  },
  dayNumber: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text,
  },
  dayNumberSelected: {
    color: colors.bg,
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  taskDotSelected: {
    backgroundColor: colors.bg,
  },
  // Tasks section
  tasksSection: {
    marginTop: spacing.sm,
  },
  tasksSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tasksSectionTitle: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
  },
  addTaskBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  addTaskBtnText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.bg,
  },
  // Form
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  titleInput: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.md,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  formLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.cardAlt,
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
    color: colors.bg,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.bg,
  },
  // Task rows
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
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
    backgroundColor: colors.cardAlt,
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  checkmark: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.bg,
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
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(207,48,74,0.12)',
    borderWidth: 1,
    borderColor: colors.red,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  deleteBtnText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.red,
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
