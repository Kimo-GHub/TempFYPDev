export const PROJECT_WORKFLOW_STORAGE_KEY = "exp_proj_workflows";

const safeRead = () => {
  try {
    const raw = localStorage.getItem(PROJECT_WORKFLOW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const safeWrite = (map) => {
  try {
    localStorage.setItem(PROJECT_WORKFLOW_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage failures
  }
};

export const PROJECT_WORKFLOW_STATUS = {
  ACTIVE: "active",
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const getWorkflowMap = () => safeRead();

export const getWorkflowEntry = (projectId) => {
  const map = safeRead();
  return map?.[String(projectId)] || null;
};

export const upsertWorkflowEntry = (projectId, entry) => {
  const map = safeRead();
  map[String(projectId)] = entry;
  safeWrite(map);
  return map;
};

export const updateWorkflowEntry = (projectId, updater) => {
  const map = safeRead();
  const key = String(projectId);
  const current = map[key] || null;
  const next = typeof updater === "function" ? updater(current) : updater;
  if (next === null || next === undefined) {
    delete map[key];
  } else {
    map[key] = next;
  }
  safeWrite(map);
  return map;
};

export const removeWorkflowEntry = (projectId) => {
  const map = safeRead();
  delete map[String(projectId)];
  safeWrite(map);
  return map;
};
