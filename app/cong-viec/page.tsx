"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { Badge, CheckIcon } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { LoadingRegion, Skeleton, StudentListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, PlusIcon, SparkleIcon } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { store } from "@/lib/store";
import { TODO_PRIORITY_META, TODO_PRIORITY_ORDER } from "@/lib/todos";
import type { Todo, TodoPriority } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Việc cần làm.
 *
 * Việc chưa xong được nhóm theo mức ưu tiên (mỗi nhóm thu gọn được, giống
 * "Đã lưu trữ" ở trang học sinh) để dễ quét mắt hơn một danh sách phẳng.
 * Không có trạng thái "lưu trữ" — việc đã xong chỉ đổi thành đã đánh dấu,
 * và người dùng tự xoá khi không cần nữa.
 */
export default function TodosPage() {
  const { data, isLoading, run } = useData();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("normal");
  const [collapsed, setCollapsed] = useState<Set<TodoPriority>>(() => new Set());
  const [showDone, setShowDone] = useState(false);

  const pending = useMemo(
    () => data.todos.filter((t) => !t.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.todos],
  );
  const done = useMemo(
    () => data.todos.filter((t) => t.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.todos],
  );

  /** Việc chưa xong, nhóm theo mức ưu tiên — nhóm rỗng không hiển thị. */
  const groups = useMemo(
    () =>
      TODO_PRIORITY_ORDER.map((p) => ({
        priority: p,
        todos: pending.filter((t) => t.priority === p),
      })).filter((g) => g.todos.length > 0),
    [pending],
  );

  function toggleGroup(p: TodoPriority) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await run(() => store.addTodo({ title: trimmed, priority }));
    setTitle("");
    setPriority("normal");
  }

  async function toggleDone(todo: Todo) {
    await run(() => store.setTodoDone(todo.id, !todo.done));
  }

  async function remove(todo: Todo) {
    await run(() => store.deleteTodo(todo.id));
    toast({
      message: `Đã xoá “${todo.title}”.`,
      tone: "success",
      onUndo: () =>
        void run(() => store.addTodo({ title: todo.title, priority: todo.priority })),
    });
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
        <LoadingRegion label="Đang tải việc cần làm">
          <StudentListSkeleton rows={3} />
        </LoadingRegion>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title="Việc cần làm"
        description={
          data.todos.length > 0
            ? `${pending.length} chưa xong${done.length > 0 ? ` · ${done.length} đã xong` : ""}`
            : undefined
        }
      />

      <form
        onSubmit={(e) => void addTodo(e)}
        className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 sm:flex-row sm:items-end"
      >
        <Field label="Việc cần làm" htmlFor="todo-title" className="flex-1">
          <Input
            id="todo-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Gọi điện xác nhận lịch với phụ huynh"
            maxLength={200}
          />
        </Field>
        <Field label="Mức độ" htmlFor="todo-priority" className="sm:w-40">
          <Select
            id="todo-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TodoPriority)}
          >
            {TODO_PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {TODO_PRIORITY_META[p].label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" intent="primary" disabled={!title.trim()}>
          <PlusIcon />
          Thêm
        </Button>
      </form>

      {data.todos.length === 0 ? (
        <EmptyState
          icon={<SparkleIcon />}
          title="Chưa có việc cần làm nào"
          description="Thêm việc ở trên, gắn nhãn mức độ ưu tiên, rồi đánh dấu khi hoàn thành."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const meta = TODO_PRIORITY_META[group.priority];
            const isCollapsed = collapsed.has(group.priority);
            return (
              <section key={group.priority} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.priority)}
                  aria-expanded={!isCollapsed}
                  className="flex min-h-11 w-fit items-center gap-1.5 rounded-full px-1 sm:min-h-8"
                >
                  <Badge tone={meta.tone}>
                    {meta.label} ({group.todos.length})
                  </Badge>
                  <svg
                    viewBox="0 0 16 16"
                    className={cn(
                      "size-3.5 text-fg-subtle transition-transform duration-(--dur-fast)",
                      !isCollapsed && "rotate-90",
                    )}
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {!isCollapsed && (
                  <ul className="flex flex-col gap-2">
                    {group.todos.map((todo) => (
                      <TodoRow
                        key={todo.id}
                        todo={todo}
                        onToggle={() => void toggleDone(todo)}
                        onDelete={() => void remove(todo)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {done.length > 0 && (
            <section className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 text-left text-sm font-medium text-fg-muted hover:text-fg sm:min-h-9"
              >
                <svg
                  viewBox="0 0 16 16"
                  className={cn(
                    "size-3.5 transition-transform duration-(--dur-fast)",
                    showDone && "rotate-90",
                  )}
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Đã xong ({done.length})
              </button>

              {showDone && (
                <ul className="flex flex-col gap-2">
                  {done.map((todo) => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      onToggle={() => void toggleDone(todo)}
                      onDelete={() => void remove(todo)}
                      showPriority
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
  showPriority = false,
}: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  /** Hiện badge ưu tiên trên dòng — dùng ở mục "Đã xong", nơi không còn nhóm theo mức ưu tiên. */
  showPriority?: boolean;
}) {
  const meta = TODO_PRIORITY_META[todo.priority];

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-line bg-surface p-3",
        todo.done && "bg-surface-inset",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.done ? `Bỏ đánh dấu “${todo.title}”` : `Đánh dấu đã xong “${todo.title}”`}
        onClick={onToggle}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-(--dur-fast)",
          todo.done
            ? "border-paid-border bg-paid text-fg-onaccent"
            : "border-line-strong bg-surface text-transparent hover:border-primary",
        )}
      >
        <CheckIcon className="size-3.5" />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-base text-fg",
            todo.done && "text-fg-subtle line-through",
          )}
        >
          {todo.title}
        </p>
      </div>

      {showPriority && <Badge tone={meta.tone}>{meta.label}</Badge>}

      <Button
        intent="quiet"
        size="icon"
        onClick={onDelete}
        aria-label={`Xoá ${todo.title}`}
        className="shrink-0 text-fg-subtle hover:text-overdue-fg"
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
          <path
            d="M3 5h10M6.5 5V3.5h3V5M4.5 5l.5 8h6l.5-8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Button>
    </li>
  );
}
