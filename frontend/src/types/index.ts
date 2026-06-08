export type UserRole = 'SUPER_ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type EmployeeStatus =
  | 'ONLINE_ACTIVE'
  | 'ONLINE_IDLE'
  | 'SCREEN_LOCKED'
  | 'ON_BREAK'
  | 'OFFLINE'
  | 'WORK_SESSION_ENDED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'WAITING_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  departmentId?: string;
  position?: string;
  managerId?: string;
  currentStatus?: EmployeeStatus;
  lastActiveAt?: string;
  department?: Department;
  teamMemberships?: TeamMembership[];
  assignedTasks?: Task[];
  workSessions?: WorkSession[];
  uploadedFiles?: FileRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMembership {
  id: string;
  teamId: string;
  userId: string;
  team?: { id: string; name: string };
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  manager?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  _count?: { members: number; teams: number };
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  comment: string;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileId: string;
  file?: FileRecord;
  createdAt: string;
}

export interface FileRecord {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileType: string;
  description?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedToId?: string;
  createdById: string;
  departmentId?: string;
  parentTaskId?: string;
  dueDate?: string;
  estimatedMinutes?: number;
  actualMinutes: number;
  completionPercent: number;
  assignedTo?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role'>;
  createdBy?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role'>;
  department?: Pick<Department, 'id' | 'name'>;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  subTasks?: Array<{ id: string; title: string; status: TaskStatus; assignedToId?: string }>;
  _count?: { subTasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WorkSessionToday {
  sessions: WorkSession[];
  totals: {
    active: number;
    idle: number;
    break: number;
    locked: number;
    offline: number;
  };
  activeSession?: WorkSession;
}

export interface WorkSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  totalBreakSeconds: number;
  totalLockedSeconds: number;
  status: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  message: string | string[];
}
