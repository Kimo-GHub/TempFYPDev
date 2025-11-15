import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";
import {
  PROJECT_WORKFLOW_STATUS,
  PROJECT_WORKFLOW_STORAGE_KEY,
  getWorkflowMap,
  updateWorkflowEntry,
} from "../../utils/projectWorkflow";

const TASK_STATUS_META = {
  todo: { label: "To do", badge: "bg-gray-100 text-gray-700" },
  in_progress: { label: "In progress", badge: "bg-amber-50 text-amber-700" },
  done: { label: "Done", badge: "bg-emerald-50 text-emerald-700" },
};

const TASK_COLORS = [
  { value: "#EEF2FF", name: "Lavender" },
  { value: "#ECFDF5", name: "Mint" },
  { value: "#FFF7ED", name: "Peach" },
  { value: "#FDF2F8", name: "Rose" },
  { value: "#E0F2FE", name: "Sky" },
];

const WORKFLOW_BADGES = {
  [PROJECT_WORKFLOW_STATUS.SUBMITTED]: {
    label: "Pending approval",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  [PROJECT_WORKFLOW_STATUS.REJECTED]: {
    label: "Changes requested",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
  [PROJECT_WORKFLOW_STATUS.APPROVED]: {
    label: "Finished",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
};

const taskFormTemplate = () => ({
  title: "",
  description: "",
  due_date: "",
  status: "todo",
  color: TASK_COLORS[0].value,
  attachments: [],
  completed: false,
});

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const formatBytes = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
};

export default function Projects() {
  const currentUserId = (() => {
    try {
      return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null;
    } catch {
      return null;
    }
  })();

  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 9, q: "", user_id: currentUserId });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [viewing, setViewing] = useState(null);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetRows, setBudgetRows] = useState([]);

  const [workflowMap, setWorkflowMap] = useState(() => getWorkflowMap());

  const storageKey = currentUserId ? `exp_proj_tasks_${currentUserId}` : null;
  const [tasksByProject, setTasksByProject] = useState({});
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [taskForm, setTaskForm] = useState(() => taskFormTemplate());
  const [taskError, setTaskError] = useState("");
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const [taskTab, setTaskTab] = useState("create");

  useEffect(() => {
    setFilters((prev) => ({ ...prev, user_id: currentUserId }));
  }, [currentUserId]);

  useEffect(() => {
    setSearchInput(filters.q || "");
  }, [filters.q]);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await apiService.getProjects(filters);
      setRows(res?.results ?? []);
      setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
    } catch (e) {
      setErr(e?.message || "Failed to load projects");
      setRows([]);
      setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.page_size, filters.q, filters.user_id]);

  const onChangePage = (page) => {
    if (page < 1 || page > info.total_pages) return;
    setFilters((f) => ({ ...f, page }));
  };

  const pages = useMemo(() => {
    const arr = [];
    const { current_page, total_pages } = info;
    const start = Math.max(1, current_page - 2);
    const end = Math.min(total_pages, start + 4);
    for (let p = start; p <= end; p += 1) arr.push(p);
    return arr;
  }, [info]);

  useEffect(() => {
    if (!storageKey) {
      setTasksByProject({});
      setTasksLoaded(false);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setTasksByProject(parsed && typeof parsed === "object" ? parsed : {});
      } else {
        setTasksByProject({});
      }
    } catch {
      setTasksByProject({});
    }
    setTasksLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !tasksLoaded) return;
    localStorage.setItem(storageKey, JSON.stringify(tasksByProject));
  }, [tasksByProject, storageKey, tasksLoaded]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === PROJECT_WORKFLOW_STORAGE_KEY) {
        setWorkflowMap(getWorkflowMap());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    if (!viewing) return;
    setTaskForm(taskFormTemplate());
    setTaskError("");
    setAttachmentsBusy(false);
    setTaskTab("create");
  }, [viewing?.id]);

  useEffect(() => {
    if (!viewing) return;
    const entry = workflowEntryFor(viewing.id);
    if ((entry?.status || PROJECT_WORKFLOW_STATUS.ACTIVE) === PROJECT_WORKFLOW_STATUS.APPROVED) {
      setTaskTab("list");
    }
  }, [viewing?.id, workflowMap]);

  const getTasksForProject = (projectId) => (tasksByProject[String(projectId)] ?? []).map((task) => ({
    completed: false,
    ...task,
  }));

  const workflowEntryFor = (projectId) => workflowMap[String(projectId)] || null;

  const applyWorkflowUpdate = (projectId, updater) => {
    const next = updateWorkflowEntry(projectId, updater);
    setWorkflowMap(next);
  };

  const updateTasksForProject = (projectId, updater) => {
    const key = String(projectId);
    setTasksByProject((prev) => {
      const current = prev[key] ?? [];
      const updated = updater(current);
      const next = { ...prev };
      if (updated.length) next[key] = updated;
      else delete next[key];
      return next;
    });
  };

  const handleAddTask = () => {
    if (!viewing) return;
    if (!taskForm.title.trim()) {
      setTaskError("Task name is required");
      return;
    }
    const payload = {
      id: Date.now(),
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      due_date: taskForm.due_date || "",
      status: taskForm.status || "todo",
      color: taskForm.color || TASK_COLORS[0].value,
      attachments: taskForm.attachments || [],
      completed: false,
    };
    updateTasksForProject(viewing.id, (current) => [payload, ...current]);
    setTaskForm(taskFormTemplate());
    setTaskError("");
  };

  const handleAttachmentChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setAttachmentsBusy(true);
    try {
      const converted = await Promise.all(
        files.map(async (file) => ({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: await readFileAsDataUrl(file),
        }))
      );
      setTaskForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...converted] }));
      setTaskError("");
    } catch {
      setTaskError("Could not read one of the attachments. Please try again.");
    } finally {
      setAttachmentsBusy(false);
      event.target.value = "";
    }
  };

  const handleRemoveAttachment = (attachmentId) => {
    setTaskForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((file) => file.id !== attachmentId),
    }));
  };

  const handleTaskStatusChange = (projectId, taskId, nextStatus) => {
    updateTasksForProject(projectId, (current) =>
      current.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task))
    );
  };

  const handleTaskDelete = (projectId, taskId) => {
    updateTasksForProject(projectId, (current) => current.filter((task) => task.id !== taskId));
  };
  const handleToggleTaskCompleted = (projectId, taskId) => {
    updateTasksForProject(projectId, (current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleFinalizeProject = () => {
    if (!viewing) return;
    applyWorkflowUpdate(viewing.id, () => ({
      status: PROJECT_WORKFLOW_STATUS.SUBMITTED,
      submittedAt: new Date().toISOString(),
      submittedBy: currentUserId,
      projectId: viewing.id,
      projectName: viewing.name,
      projectCode: viewing.code,
      projectDescription: viewing.description,
      tasksSnapshot: projectTasks,
    }));
  };

  const onView = async (project) => {
    setViewing(project);
    setBudgetsLoading(true);
    setBudgetRows([]);
    try {
      const res = await apiService.getBudgets({ project_id: project.id, page: 1, page_size: 100 });
      setBudgetRows(res?.results ?? []);
    } catch {
      setBudgetRows([]);
    } finally {
      setBudgetsLoading(false);
    }
  };

  const taskStatusOptions = Object.entries(TASK_STATUS_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  }));

  const projectTasks = viewing ? getTasksForProject(viewing.id) : [];
  const completedTaskCount = projectTasks.filter((task) => task.completed).length;
  const projectWorkflowEntry = viewing ? workflowEntryFor(viewing.id) : null;
  const projectWorkflowStatus = projectWorkflowEntry?.status || PROJECT_WORKFLOW_STATUS.ACTIVE;
  const isFinishedProject = projectWorkflowStatus === PROJECT_WORKFLOW_STATUS.APPROVED;
  const allTasksCompleted = projectTasks.length > 0 && completedTaskCount === projectTasks.length;
  const canRequestFinalize =
    projectWorkflowStatus === PROJECT_WORKFLOW_STATUS.ACTIVE || projectWorkflowStatus === PROJECT_WORKFLOW_STATUS.REJECTED;
  const finalizeDisabled =
    !allTasksCompleted ||
    projectWorkflowStatus === PROJECT_WORKFLOW_STATUS.SUBMITTED ||
    projectWorkflowStatus === PROJECT_WORKFLOW_STATUS.APPROVED;
  const finalizeButtonLabel = projectWorkflowStatus === PROJECT_WORKFLOW_STATUS.REJECTED ? "Resubmit for review" : "Finalize project";
  const projectWorkflowMessage = (() => {
    switch (projectWorkflowStatus) {
      case PROJECT_WORKFLOW_STATUS.SUBMITTED:
        return "Submitted for admin review. We will notify you once the project is approved.";
      case PROJECT_WORKFLOW_STATUS.REJECTED:
        return "Admin requested additional changes. Update the project and resubmit when ready.";
      case PROJECT_WORKFLOW_STATUS.APPROVED:
        return "Admin approved this project. It is now part of your finished work.";
      default:
        return "Mark every task as finished before sending the project for admin review.";
    }
  })();
  const workflowReviewNote = projectWorkflowEntry?.reviewNote;

  const renderProjectCard = (project) => {
    const projectTasks = getTasksForProject(project.id);
    const completedCount = projectTasks.filter((task) => task.completed).length;
    const workflowEntry = workflowEntryFor(project.id);
    const workflowStatus = workflowEntry?.status || PROJECT_WORKFLOW_STATUS.ACTIVE;
    const workflowBadge = WORKFLOW_BADGES[workflowStatus];

    return (
      <div key={project.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold">{project.name}</div>
              {project.code && <div className="text-xs text-gray-500">Code: {project.code}</div>}
            </div>
            <div className="flex flex-col items-end gap-1 text-xs">
              <span
                className={`rounded-lg px-2 py-0.5 ${project.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
              >
                {project.is_active ? "Active" : "Archived"}
              </span>
              {workflowBadge && <span className={`rounded-lg px-2 py-0.5 ${workflowBadge.className}`}>{workflowBadge.label}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between p-4 text-sm text-gray-600">
          <div className="space-y-3">
            {project.description && <p className="text-gray-700 line-clamp-3">{project.description}</p>}
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {projectTasks.length === 0 ? (
                "No personal tasks yet"
              ) : (
                <div className="flex items-center justify-between">
                  <span>{projectTasks.length} tasks</span>
                  <span className="font-medium text-gray-700">
                    {completedCount}/{projectTasks.length} complete
                  </span>
                </div>
              )}
            </div>
            {workflowStatus === PROJECT_WORKFLOW_STATUS.REJECTED && workflowEntry?.reviewNote && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                Admin notes: {workflowEntry.reviewNote}
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-end">
            <button onClick={() => onView(project)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">
              View details
            </button>
          </div>
        </div>
      </div>
    );
  };

  const finishedProjects = rows.filter(
    (project) => (workflowEntryFor(project.id)?.status || PROJECT_WORKFLOW_STATUS.ACTIVE) === PROJECT_WORKFLOW_STATUS.APPROVED
  );
  const activeProjects = rows.filter(
    (project) => (workflowEntryFor(project.id)?.status || PROJECT_WORKFLOW_STATUS.ACTIVE) !== PROJECT_WORKFLOW_STATUS.APPROVED
  );

  const tabOptions = isFinishedProject
    ? [{ key: "list", label: "My list" }]
    : [
        { key: "create", label: "Create task" },
        { key: "list", label: "My list" },
      ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-gray-600">
            These are the initiatives the admin assigned to you. Track your own tasks to keep progress clear.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search projects"
            className="h-9 w-56 rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filters.page_size}
            onChange={(e) => setFilters((f) => ({ ...f, page_size: Number(e.target.value), page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            {[6, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-600">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No projects assigned to you yet.</div>
        ) : (
          <>
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Active projects</h2>
              </div>
              {activeProjects.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">No active projects on this page.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{activeProjects.map(renderProjectCard)}</div>
              )}
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Finished projects</h2>
              </div>
              {finishedProjects.length === 0 ? (
                <div className="py-4 text-sm text-gray-500">No finished projects yet.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{finishedProjects.map(renderProjectCard)}</div>
              )}
            </section>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-gray-600">
                Showing page <span className="font-medium">{info.current_page}</span> of {info.total_pages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl border px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => onChangePage(info.current_page - 1)}
                  disabled={info.current_page <= 1}
                >
                  Prev
                </button>
                {pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => onChangePage(p)}
                    className={`rounded-xl px-3 py-1 border ${
                      p === info.current_page ? "border-indigo-600 bg-indigo-600 text-white" : "hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="rounded-xl border px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => onChangePage(info.current_page + 1)}
                  disabled={info.current_page >= info.total_pages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewing(null)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="overflow-y-auto p-6" style={{ maxHeight: "90vh" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{viewing.name}</h3>
                  {viewing.code && <div className="text-xs text-gray-500">Code: {viewing.code}</div>}
                </div>
                <button onClick={() => setViewing(null)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">
                  Close
                </button>
              </div>
              {viewing.description && <p className="mt-3 text-sm text-gray-700">{viewing.description}</p>}

              <div className="mt-5">
                <div className="text-sm font-semibold text-gray-800">Budgets</div>
                {budgetsLoading ? (
                  <div className="mt-2 text-sm text-gray-600">Loading budgets...</div>
                ) : budgetRows.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-500">No budgets linked to this project yet.</div>
                ) : (
                  <div className="mt-3 overflow-x-auto rounded-2xl border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Period</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetRows.map((budget) => (
                          <tr key={budget.id} className="border-t">
                            <td className="px-3 py-2">{budget.name || "-"}</td>
                            <td className="px-3 py-2">
                              {new Intl.NumberFormat(undefined, { style: "currency", currency: budget.currency || "USD" }).format(
                                Number(budget.amount || 0)
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {(budget.period_start || "").slice(0, 10)}
                              {budget.period_end ? ` -> ${String(budget.period_end).slice(0, 10)}` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-base font-semibold">My tasks</h4>
                    <span className="text-xs text-gray-500">Tasks are saved locally per project.</span>
                  </div>
                  <div className="flex gap-2 rounded-full border border-indigo-200 bg-indigo-50 p-1 text-sm font-medium">
                    {tabOptions.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setTaskTab(tab.key)}
                        className={`rounded-full px-4 py-1 transition ${
                          taskTab === tab.key ? "bg-white text-indigo-600 shadow" : "text-gray-500 hover:text-indigo-600"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {projectTasks.length === 0
                    ? "No personal tasks yet."
                    : `Progress: ${completedTaskCount}/${projectTasks.length} tasks finished`}
                </div>
                {!isFinishedProject && taskTab === "create" && (
                  <div className="mt-4 space-y-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4 text-sm shadow-inner">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="lg:col-span-2">
                        <label className="mb-1 block text-gray-700">Task name</label>
                        <input
                          value={taskForm.title}
                          onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. Prepare weekly summary"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-gray-700">Due date</label>
                        <input
                          type="date"
                          value={taskForm.due_date}
                          onChange={(e) => setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-gray-700">Description</label>
                      <textarea
                        rows={3}
                        value={taskForm.description}
                        onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Add context, links, or acceptance criteria..."
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-gray-700">Status</label>
                        <select
                          value={taskForm.status}
                          onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value }))}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2"
                        >
                          {taskStatusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-gray-700">Color label</label>
                        <div className="flex flex-wrap gap-2">
                          {TASK_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => setTaskForm((prev) => ({ ...prev, color: color.value }))}
                              className={`h-10 w-10 rounded-xl border-2 transition hover:scale-105 ${
                                taskForm.color === color.value ? "border-indigo-600 ring-2 ring-indigo-300" : "border-transparent"
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-gray-700">Attachments</label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm hover:bg-indigo-50">
                          <input type="file" className="sr-only" multiple onChange={handleAttachmentChange} />
                          <span>Upload files</span>
                        </label>
                        {attachmentsBusy && <span className="text-xs text-gray-500">Processing attachments...</span>}
                      </div>
                      {taskForm.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {taskForm.attachments.map((file) => (
                            <div key={file.id} className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs shadow">
                              <span className="font-medium text-gray-700">{file.name}</span>
                              <span className="text-gray-500">{formatBytes(file.size)}</span>
                              <button
                                onClick={() => handleRemoveAttachment(file.id)}
                                className="text-red-500 hover:text-red-600"
                                type="button"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-gray-500">Files stay on this device only. Use them as quick references or checklists.</p>
                    </div>
                    {taskError && <div className="text-xs text-red-600">{taskError}</div>}
                    <div className="flex items-center justify-end">
                      <button
                        onClick={handleAddTask}
                        disabled={attachmentsBusy}
                        className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow ${
                          attachmentsBusy ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        {attachmentsBusy ? "Please wait..." : "Add task"}
                      </button>
                    </div>
                  </div>
                )}

                {taskTab === "list" && (
                  <div className="mt-4 space-y-3">
                {projectTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-gray-500">
                    You have not added any tasks for this project yet.
                  </div>
                ) : (
                  projectTasks.map((task) => {
                        const meta = TASK_STATUS_META[task.status] || TASK_STATUS_META.todo;
                        const taskColor = task.color || TASK_COLORS[0].value;
                        const attachments = Array.isArray(task.attachments) ? task.attachments : [];
                        const isCompleted = !!task.completed;
                        return (
                          <div
                            key={task.id}
                            className="rounded-2xl border border-gray-200 p-4 shadow-sm transition hover:-translate-y-0.5"
                            style={{ background: `linear-gradient(135deg, ${taskColor} 0%, #ffffff 80%)` }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full border border-white/40" style={{ backgroundColor: taskColor }} />
                                <div>
                                  <div className="text-sm font-semibold text-gray-800">{task.title}</div>
                                  {task.due_date && (
                                    <div className="text-xs text-gray-600">
                                      Due {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`rounded-full px-3 py-0.5 text-xs ${
                                  isCompleted ? "bg-emerald-600/10 text-emerald-700 border border-emerald-200" : meta.badge
                                }`}
                              >
                                {isCompleted ? "Finished" : meta.label}
                              </span>
                            </div>
                            {task.description && <p className="mt-2 text-sm text-gray-700">{task.description}</p>}
                            {attachments.length > 0 && (
                              <div className="mt-3 space-y-2 text-xs text-gray-600">
                                <div className="font-semibold text-gray-700">Attachments</div>
                                <div className="flex flex-wrap gap-2">
                                  {attachments.map((file) => (
                                    <a
                                      key={file.id}
                                      href={file.dataUrl}
                                      download={file.name}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-white"
                                    >
                                      {file.name}
                                      <span className="text-[10px] text-gray-500">{formatBytes(file.size)}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <select
                              value={task.status}
                              onChange={(e) => handleTaskStatusChange(viewing.id, task.id, e.target.value)}
                              className="rounded-xl border border-gray-300 px-2 py-1"
                            >
                                {taskStatusOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                          <button
                            onClick={() => handleTaskDelete(viewing.id, task.id)}
                            className="rounded-xl border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => handleToggleTaskCompleted(viewing.id, task.id)}
                            className={`rounded-xl border px-3 py-1 ${
                              isCompleted
                                ? "border-gray-200 text-gray-600 hover:bg-gray-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {isCompleted ? "Mark active" : "Mark finished"}
                          </button>
                        </div>
                      </div>
                    );
                      })
                    )}
                  </div>
                )}
                <div className="mt-5 rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Project hand-off</div>
                      <p className="text-xs text-gray-600">{projectWorkflowMessage}</p>
                      {projectWorkflowStatus === PROJECT_WORKFLOW_STATUS.REJECTED && workflowReviewNote && (
                        <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{workflowReviewNote}</p>
                      )}
                    </div>
                    {canRequestFinalize && (
                      <button
                        onClick={handleFinalizeProject}
                        disabled={finalizeDisabled}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                          finalizeDisabled ? "bg-indigo-200" : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        {finalizeButtonLabel}
                      </button>
                    )}
                  </div>
                  {projectWorkflowStatus === PROJECT_WORKFLOW_STATUS.SUBMITTED && (
                    <p className="mt-2 text-xs text-amber-700">You will be notified once the admin team reviews this submission.</p>
                  )}
                  {projectWorkflowStatus === PROJECT_WORKFLOW_STATUS.APPROVED && (
                    <p className="mt-2 text-xs text-emerald-700">Admin approved this project. It now lives under Finished projects.</p>
                  )}
                </div>
                <div className="mt-5 flex items-center justify-end">
                  <button onClick={() => setViewing(null)} className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50">
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
