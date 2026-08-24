import { toPlainText } from "../utils/plainText.js";

function humanize(value) {
  if (value === undefined || value === null || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtMoney(value, currency = "RWF") {
  if (value === undefined || value === null || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${currency} ${num.toLocaleString("en-US")}`;
}

function personName(row, keys = ["user", "preparer", "applicant", "creator"]) {
  for (const key of keys) {
    if (row?.[key]?.names) return row[key].names;
  }
  return row?.names || "—";
}

function actorLine(actor) {
  if (!actor?.names) return null;
  return actor.role ? `${actor.names} (${humanize(actor.role)})` : actor.names;
}

function cleanDetails(rows) {
  return (rows || []).filter((row) => row?.value !== undefined && row?.value !== null && row?.value !== "" && row?.value !== "—");
}

export function missionDetails(row, { actor } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Applicant", value: personName(row) },
    { label: "Destination", value: row.destination },
    { label: "Purpose", value: row.purpose },
    { label: "Departure date", value: fmtDate(row.departure_date) },
    { label: "Return date", value: fmtDate(row.return_date) },
    { label: "Days requested", value: row.days_requested },
    row.days_authorized ? { label: "Days authorized", value: row.days_authorized } : null,
    row.vihicle_prack ? { label: "Vehicle / transport", value: row.vihicle_prack } : null,
    { label: "Current status", value: humanize(row.mission_requests_status) },
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function leaveDetails(row, { actor } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Applicant", value: personName(row) },
    { label: "Leave type", value: humanize(row.leave_type) },
    { label: "Leave from", value: fmtDate(row.leave_from) },
    { label: "Return date", value: fmtDate(row.return_date) },
    { label: "Days requested", value: row.requested_days },
    row.days_authorized ? { label: "Days authorized", value: row.days_authorized } : null,
    row.carry_over_days_used ? { label: "Carry-over days used", value: row.carry_over_days_used } : null,
    row.current_year_days_used ? { label: "Current-year days used", value: row.current_year_days_used } : null,
    { label: "Current status", value: humanize(row.leave_requests_status) },
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function leaveScheduleDetails(row, { actor, applicant } = {}) {
  const name = applicant?.names || personName(row);
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Employee", value: name },
    { label: "Scheduled from", value: fmtDate(row.from_date) },
    { label: "Scheduled return", value: fmtDate(row.return_date) },
    { label: "Status", value: humanize(row.status) },
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function requisitionDetails(row, { actor, preparer } = {}) {
  const prep = preparer?.names || row.preparer?.names || "—";
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Prepared by", value: prep },
    { label: "Department", value: row.department?.name || row.dept_name },
    { label: "Requisition date", value: fmtDate(row.date) },
    { label: "Budget source", value: row.budget_source },
    { label: "Account code", value: row.account_code },
    { label: "Total amount", value: fmtMoney(row.total_amount_requested) },
    row.amount_in_words ? { label: "Amount in words", value: row.amount_in_words } : null,
    { label: "Status", value: humanize(row.status) },
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function vehicleDetails(row, { actor } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Requested by", value: personName(row, ["preparer", "user"]) },
    { label: "Title", value: row.title },
    { label: "Description", value: row.description },
    { label: "Date", value: fmtDate(row.date) },
    row.start_time ? { label: "Start time", value: row.start_time } : null,
    row.end_time ? { label: "End time", value: row.end_time } : null,
    { label: "Type", value: row.type === "Other" ? row.type_other || "Other" : row.type },
    { label: "Status", value: humanize(row.status) },
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function documentDetails(row, { actor, sharedBy } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Document title", value: row.title },
    { label: "Description", value: row.description },
    { label: "Status", value: humanize(row.status) },
    { label: "Created by", value: personName(row, ["creator", "user"]) || row.created_by_name },
    sharedBy?.names ? { label: "Shared by", value: sharedBy.names } : null,
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function reportDetails(row, { actor, sender } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Report title", value: row.title },
    { label: "Report type", value: humanize(row.type) },
    { label: "Period", value: row.period || row.report_period },
    row.description ? { label: "Description", value: row.description } : null,
    sender?.names ? { label: "Shared by", value: sender.names } : null,
    actorLine(actor || sender) ? { label: "Action by", value: actorLine(actor || sender) } : null,
  ]);
}

export function ticketDetails(row, { actor, replyPreview } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Title", value: row.title },
    { label: "Category", value: humanize(row.category) },
    { label: "Priority", value: humanize(row.priority) },
    { label: "Status", value: humanize(row.status) },
    { label: "Description", value: row.description },
    replyPreview ? { label: "Latest reply", value: replyPreview } : null,
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function communicationDetails(row, { actor } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Subject", value: row.title },
    { label: "Type", value: humanize(row.communication_type) },
    { label: "Description", value: row.description },
    row.start_time ? { label: "Start", value: fmtDateTime(row.start_time) } : null,
    row.end_time ? { label: "End", value: fmtDateTime(row.end_time) } : null,
    actorLine(actor) ? { label: "From", value: actorLine(actor) } : null,
  ]);
}

export function membershipReportDetails(row, { actor } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Title", value: row.title },
    { label: "Location", value: row.location },
    { label: "Period", value: `${fmtDate(row.start_date)} – ${fmtDate(row.end_date)}` },
    { label: "Status", value: humanize(row.status) },
    row.comment ? { label: "Remarks", value: row.comment } : null,
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function assetDetails(row, { actor } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Asset name", value: row.name || row.asset_name },
    { label: "Serial / tag", value: row.serial_number || row.tag_number },
    { label: "Status", value: humanize(row.status) },
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function todoDetails(row, { actor } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Task", value: row.title || row.task },
    { label: "Description", value: row.description },
    { label: "Due date", value: fmtDate(row.due_date) },
    { label: "Priority", value: humanize(row.priority) },
    { label: "Status", value: humanize(row.status) },
    actorLine(actor) ? { label: "Assigned by", value: actorLine(actor) } : null,
  ]);
}

export function edNoteDetails(row, { actor } = {}) {
  return cleanDetails([
    { label: "Reference", value: `#${row.id}` },
    { label: "Subject", value: row.title || row.subject },
    { label: "Module", value: humanize(row.module) },
    { label: "Message", value: row.note || row.message || row.content },
    actorLine(actor) ? { label: "From", value: actorLine(actor) } : null,
  ]);
}

export function userAccountDetails(user, { actor, action } = {}) {
  return cleanDetails([
    { label: "Staff name", value: user.names },
    { label: "Email", value: user.email },
    { label: "Role", value: humanize(user.role) },
    action ? { label: "Account action", value: humanize(action) } : null,
    actorLine(actor) ? { label: "Action by", value: actorLine(actor) } : null,
  ]);
}

export function genericDetails(items) {
  return cleanDetails(items);
}

const DETAIL_BUILDERS = {
  mission: missionDetails,
  leave: leaveDetails,
  leave_schedule: leaveScheduleDetails,
  requisition: requisitionDetails,
  vehicle: vehicleDetails,
  document: documentDetails,
  report: reportDetails,
  ticket: ticketDetails,
  communication: communicationDetails,
  membership_report: membershipReportDetails,
  asset: assetDetails,
  todo: todoDetails,
  ed_note: edNoteDetails,
  user: userAccountDetails,
};

export function buildEmailPayload(module, record, { intro, note, actionRequired, actor, extras = {} } = {}) {
  const builder = DETAIL_BUILDERS[module];
  const details = (builder ? builder(record, { actor, ...extras }) : genericDetails(extras.details || []))
    .map((row) => ({
      ...row,
      label: toPlainText(row.label),
      value: toPlainText(row.value),
    }))
    .filter((row) => row.value);
  return {
    intro: toPlainText(intro),
    details,
    note: toPlainText(note),
    actionRequired: toPlainText(actionRequired),
  };
}
