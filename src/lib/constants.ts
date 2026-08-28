import type { ModuleId } from "./types";

export const MODULES: {
  id: ModuleId;
  label: string;
  scope: "project" | "global";
  description: string;
}[] = [
  { id: "dashboard", label: "Dashboard", scope: "project", description: "Project overview and KPIs" },
  { id: "calendar", label: "Calendar", scope: "project", description: "Milestones, inspections, deliveries" },
  { id: "budget", label: "Budget", scope: "project", description: "Cost codes and committed spend" },
  { id: "tasks", label: "Schedule", scope: "project", description: "Work packages and task tracking" },
  { id: "documents", label: "Documents", scope: "project", description: "Drawings, specs, submittals" },
  { id: "rfis", label: "RFIs", scope: "project", description: "Requests for information" },
  { id: "change_orders", label: "Change Orders", scope: "project", description: "Scope and cost changes" },
  { id: "daily_logs", label: "Daily Logs", scope: "project", description: "Site reports and crew counts" },
  { id: "punch", label: "Punch List", scope: "project", description: "Closeout deficiencies" },
  { id: "safety", label: "Safety", scope: "project", description: "Incidents and observations" },
  { id: "team", label: "Team", scope: "project", description: "Project roster and roles" },
  { id: "reports", label: "Reports", scope: "project", description: "Booklets, summaries, and custom reports" },
  { id: "clients", label: "Clients", scope: "global", description: "Client accounts and companies" },
  { id: "users", label: "Users", scope: "global", description: "Employees and client users" },
];

export const PROJECT_MODULES = MODULES.filter((m) => m.scope === "project");

export const PROJECT_STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
] as const;

export const PROJECT_PHASES = [
  { value: "preconstruction", label: "Preconstruction" },
  { value: "foundation", label: "Foundation" },
  { value: "structure", label: "Structure" },
  { value: "envelope", label: "Envelope" },
  { value: "interiors", label: "Interiors" },
  { value: "finishing", label: "Finishing" },
  { value: "closeout", label: "Closeout" },
] as const;

export const PROJECT_TYPES = [
  "Commercial",
  "Residential",
  "Industrial",
  "Institutional",
  "Infrastructure",
  "Mixed-use",
] as const;

export const TASK_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
] as const;

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const BUDGET_CATEGORIES = [
  "General conditions",
  "Sitework",
  "Concrete",
  "Steel",
  "Masonry",
  "Carpentry",
  "Envelope",
  "MEP",
  "Interiors",
  "Equipment",
  "Contingency",
] as const;

export const BUDGET_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "committed", label: "Committed" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
] as const;

export const EVENT_TYPES = [
  { value: "milestone", label: "Milestone" },
  { value: "inspection", label: "Inspection" },
  { value: "delivery", label: "Delivery" },
  { value: "meeting", label: "Meeting" },
  { value: "weather", label: "Weather hold" },
] as const;

export const DOC_CATEGORIES = [
  "Drawings",
  "Specifications",
  "Submittals",
  "Contracts",
  "Permits",
  "Photos",
  "Reports",
  "Other",
] as const;

export const RFI_STATUSES = [
  { value: "open", label: "Open" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Closed" },
] as const;

export const CO_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export const PUNCH_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
] as const;

export const SAFETY_SEVERITIES = [
  { value: "observation", label: "Observation" },
  { value: "near_miss", label: "Near miss" },
  { value: "minor", label: "Minor" },
  { value: "serious", label: "Serious" },
] as const;

export const SAFETY_STATUSES = [
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "closed", label: "Closed" },
] as const;

export const QUOTE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "converted", label: "Converted" },
] as const;

export const INVOICE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
] as const;

export const TEAM_ROLES = [
  "Project Manager",
  "Superintendent",
  "Estimator",
  "Foreman",
  "Safety Officer",
  "Coordinator",
  "Client Contact",
  "Architect",
  "Engineer",
] as const;

export const SESSION_KEY = "frx_portal_session";
export const VIEW_AS_KEY = "frx_portal_view_as";
export const THEME_KEY = "frx_portal_theme";
export const LOCALE_KEY = "frx_portal_locale";
export const CLIENT_KEY = "frx_portal_selected_client";
export const NAV_SECTIONS_KEY = "frx_portal_nav_sections";
export const TUTORIAL_KEY = "frx_portal_tutorial";
export const SETTINGS_SECTIONS_KEY = "frx_portal_settings_sections";
export const BOARD_COLLAPSE_KEY = "frx_portal_board_collapsed";
export const DASHBOARD_LAYOUT_KEY = "frx_portal_dashboard_layout";
