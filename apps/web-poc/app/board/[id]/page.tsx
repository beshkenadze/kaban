"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, Calendar, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  columnId: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
}

const COLUMNS: Column[] = [
  { id: "todo", title: "To Do", color: "bg-slate-500" },
  { id: "in-progress", title: "In Progress", color: "bg-blue-500" },
  { id: "review", title: "Review", color: "bg-amber-500" },
  { id: "done", title: "Done", color: "bg-emerald-500" },
];

const INITIAL_TASKS: Task[] = [
  {
    id: "1",
    title: "Design System",
    description: "Create a comprehensive design system with colors, typography, and components",
    priority: "high",
    dueDate: "2026-02-01",
    columnId: "todo",
  },
  {
    id: "2",
    title: "API Integration",
    description: "Integrate ZenStack ORM with Turso database",
    priority: "high",
    dueDate: "2026-02-03",
    columnId: "in-progress",
  },
  {
    id: "3",
    title: "Authentication",
    description: "Implement user authentication with Clerk or NextAuth",
    priority: "medium",
    dueDate: "2026-02-05",
    columnId: "todo",
  },
  {
    id: "4",
    title: "Drag & Drop",
    description: "Add drag and drop functionality for task management",
    priority: "medium",
    dueDate: "2026-02-02",
    columnId: "review",
  },
];

const PRIORITY_COLORS = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [activeColumn, setActiveColumn] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const addTask = (columnId: string) => {
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      description: newTaskDescription,
      priority: newTaskPriority,
      dueDate: new Date().toISOString().split("T")[0],
      columnId,
    };

    setTasks([...tasks, newTask]);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskPriority("medium");
    setIsDialogOpen(false);
  };

  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter((t) => t.id !== taskId));
  };

  const moveTask = (taskId: string, newColumnId: string) => {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, columnId: newColumnId } : t)));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newColumnId = destination.droppableId;

    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === draggableId ? { ...t, columnId: newColumnId } : t
      )
    );
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                Kaban Board
              </h1>
              <p className="text-slate-400">
                ZenStack + Turso POC
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </div>
              <Button variant="outline" size="sm">
                Share Board
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-6">
          {COLUMNS.map((column) => {
            const columnTasks = tasks.filter((t) => t.columnId === column.id);

            return (
              <div key={column.id} className="flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", column.color)} />
                    <h2 className="font-semibold text-slate-200 uppercase tracking-wider text-sm">
                      {column.title}
                    </h2>
                    <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-3 min-h-[200px]"
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                              }}
                            >
                              <Card
                                className={cn(
                                  "bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-all group cursor-pointer",
                                  snapshot.isDragging && "shadow-lg border-indigo-500/50 rotate-2"
                                )}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-2">
                                    <span
                                      className={cn(
                                        "text-xs px-2 py-0.5 rounded border",
                                        PRIORITY_COLORS[task.priority]
                                      )}
                                    >
                                      {task.priority}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => deleteTask(task.id)}
                                    >
                                      <Trash2 className="h-3 w-3 text-slate-500 hover:text-red-400" />
                                    </Button>
                                  </div>

                                  <h3 className="font-medium text-slate-200 mb-1">{task.title}</h3>
                                  <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                                    {task.description}
                                  </p>

                                  <div className="flex items-center justify-between text-xs text-slate-500">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {task.dueDate}
                                    </div>
                                    <div className="flex -space-x-2">
                                      <div className="w-6 h-6 rounded-full bg-indigo-500/30 border border-slate-800 flex items-center justify-center text-[10px]">
                                        JD
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                <Dialog open={isDialogOpen && activeColumn === column.id} onOpenChange={(open: boolean) => {
                  setIsDialogOpen(open);
                  if (open) setActiveColumn(column.id);
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="mt-4 w-full border-2 border-dashed border-slate-800 hover:border-slate-600 hover:bg-slate-900/50 h-12"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add New Task</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Create a new task in {column.title}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Title</label>
                        <Input
                          placeholder="Task title..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Description</label>
                        <Input
                          placeholder="Task description..."
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Priority</label>
                        <div className="flex gap-2">
                          {(["low", "medium", "high"] as const).map((p) => (
                            <Button
                              key={p}
                              type="button"
                              variant={newTaskPriority === p ? "default" : "outline"}
                              size="sm"
                              onClick={() => setNewTaskPriority(p)}
                              className={cn(
                                "capitalize",
                                newTaskPriority === p && PRIORITY_COLORS[p]
                              )}
                            >
                              {p}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        className="border-slate-700"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => addTask(column.id)}
                        disabled={!newTaskTitle.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        Add Task
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </DragDropContext>
  );
}
