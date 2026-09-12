import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatDateTime } from "@/lib/utils";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";
import { User } from "@/models/User";

export type ReportFormat = "xlsx" | "pdf";

type SupportDoc = {
  student?: unknown;
  supportType?: unknown;
  status?: string;
  assignedAt?: Date;
  completedAt?: Date;
  outcome?: string;
  comments?: unknown;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function nameOf(value: unknown) {
  if (typeof value === "object" && value !== null && "name" in value) {
    return String((value as { name?: string }).name ?? "");
  }
  return "";
}

function tally(students: Array<Record<string, unknown>>, key: "branch" | "group" | "batch") {
  const counts = new Map<string, number>();
  for (const student of students) {
    const name = nameOf(student[key]) || "Unassigned";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function visibleComments(item: SupportDoc, includePending: boolean) {
  return ((item.comments ?? []) as unknown as Array<Record<string, unknown>>).filter((comment) => {
    if (comment.deleteStatus === "approved") return false;
    if (!includePending && comment.deleteStatus === "pending") return false;
    return true;
  });
}

export function reportSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "moderator";
}

export async function loadModeratorReport(id: string) {
  const target = await User.findById(id).lean();
  if (!target) return null;

  const supports = (await Support.find({ assignedModerator: id })
    .populate("student supportType comments.createdBy")
    .populate({ path: "student", populate: [{ path: "branch" }, { path: "group" }, { path: "batch" }] })
    .sort({ createdAt: -1 })
    .lean()) as SupportDoc[];

  const studentIds = [
    ...new Set(supports.map((item) => String(asRecord(item.student)?._id ?? item.student ?? "")).filter(Boolean)),
  ];
  const students = studentIds.length
    ? ((await Student.find({ _id: { $in: studentIds } }).populate("branch group batch").lean()) as Array<
        Record<string, unknown>
      >)
    : [];

  const supportRows = supports.map((item) => {
    const student = asRecord(item.student);
    const comments = visibleComments(item, false);
    return {
      student: nameOf(student),
      studentNumber: String(student?.studentNumber ?? ""),
      roll: String(student?.roll ?? ""),
      branch: nameOf(student?.branch),
      group: nameOf(student?.group),
      batch: nameOf(student?.batch),
      supportType: nameOf(item.supportType),
      status: String(item.status ?? ""),
      assigned: formatDateTime(item.assignedAt),
      completed: formatDateTime(item.completedAt),
      lastComment: String(comments[comments.length - 1]?.text ?? item.outcome ?? ""),
    };
  });

  const commentRows = supports.flatMap((item) => {
    const student = asRecord(item.student);
    return visibleComments(item, true).map((comment) => ({
      student: nameOf(student),
      roll: String(student?.roll ?? ""),
      supportType: nameOf(item.supportType),
      when: formatDateTime((comment.updatedAt ?? comment.createdAt) as Date | undefined),
      by: nameOf(comment.createdBy) || "Team",
      text: String(comment.text ?? ""),
    }));
  });

  return {
    target: {
      name: String(target.name ?? ""),
      email: String(target.email ?? ""),
      phone: String(target.phone ?? ""),
      isActive: Boolean(target.isActive),
    },
    generated: formatDateTime(new Date()),
    studentCount: studentIds.length,
    supportCount: supports.length,
    pending: supports.filter((item) => item.status === "pending").length,
    inProgress: supports.filter((item) => item.status === "in_progress").length,
    completed: supports.filter((item) => item.status === "completed").length,
    cancelled: supports.filter((item) => item.status === "cancelled").length,
    branches: tally(students, "branch"),
    groups: tally(students, "group"),
    batches: tally(students, "batch"),
    supportRows,
    commentRows,
  };
}

export type ModeratorReport = NonNullable<Awaited<ReturnType<typeof loadModeratorReport>>>;

export async function buildExcelReport(report: ModeratorReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Medico Support";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ width: 28 }, { width: 42 }];
  summary.addRows([
    ["Moderator report", report.target.name],
    ["Email", report.target.email],
    ["Phone", report.target.phone],
    ["Status", report.target.isActive ? "Active" : "Disabled"],
    ["Generated", report.generated],
    [],
    ["Students", report.studentCount],
    ["Supports", report.supportCount],
    ["Pending", report.pending],
    ["In progress", report.inProgress],
    ["Completed", report.completed],
    ["Cancelled", report.cancelled],
  ]);

  const placement = workbook.addWorksheet("Placement");
  placement.columns = [{ width: 18 }, { width: 36 }, { width: 14 }];
  placement.addRow(["Type", "Name", "Students"]);
  for (const [name, count] of report.branches) placement.addRow(["Branch", name, count]);
  for (const [name, count] of report.groups) placement.addRow(["Group", name, count]);
  for (const [name, count] of report.batches) placement.addRow(["Batch", name, count]);

  const cases = workbook.addWorksheet("Supports");
  cases.columns = [18, 22, 16, 16, 18, 18, 22, 14, 22, 22, 40].map((width) => ({ width }));
  cases.addRow([
    "Student",
    "S-Number",
    "Roll",
    "Branch",
    "Group",
    "Batch",
    "Support type",
    "Status",
    "Assigned",
    "Completed",
    "Last comment",
  ]);
  for (const row of report.supportRows) {
    cases.addRow([
      row.student,
      row.studentNumber,
      row.roll,
      row.branch,
      row.group,
      row.batch,
      row.supportType,
      row.status,
      row.assigned,
      row.completed,
      row.lastComment,
    ]);
  }

  const notes = workbook.addWorksheet("Comments");
  notes.columns = [22, 16, 18, 22, 18, 50].map((width) => ({ width }));
  notes.addRow(["Student", "Roll", "Support type", "When", "By", "Comment"]);
  for (const row of report.commentRows) {
    notes.addRow([row.student, row.roll, row.supportType, row.when, row.by, row.text]);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) doc.addPage();
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 28);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f4c5c").text(title);
  doc.moveDown(0.25);
  doc.strokeColor("#d6dde3").lineWidth(0.8).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.35);
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string) {
  const x = doc.x;
  const y = doc.y;
  doc.font("Helvetica").fontSize(9).fillColor("#5b6770").text(label, x, y, { width: 90, continued: false });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#16313d").text(value || "—", x + 96, y, { width: 360 });
  doc.y = Math.max(doc.y, y + 14);
  doc.x = x;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  widths: number[]
) {
  const left = doc.page.margins.left;
  const headerH = 18;
  const minRow = 16;

  const drawHeader = () => {
    ensureSpace(doc, headerH + 4);
    let x = left;
    const y = doc.y;
    doc.rect(left, y, widths.reduce((a, b) => a + b, 0), headerH).fill("#0f4c5c");
    headers.forEach((header, index) => {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text(header, x + 4, y + 5, {
        width: widths[index] - 8,
        lineBreak: false,
      });
      x += widths[index];
    });
    doc.y = y + headerH;
  };

  drawHeader();

  rows.forEach((cells, rowIndex) => {
    doc.font("Helvetica").fontSize(8);
    const heights = cells.map((cell, index) => doc.heightOfString(cell || "—", { width: widths[index] - 8 }));
    const rowH = Math.max(minRow, ...heights) + 6;
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (rowIndex % 2 === 0) {
      doc.rect(left, y, widths.reduce((a, b) => a + b, 0), rowH).fill("#f4f7f8");
    }
    let x = left;
    cells.forEach((cell, index) => {
      doc.font("Helvetica").fontSize(8).fillColor("#16313d").text(cell || "—", x + 4, y + 4, {
        width: widths[index] - 8,
      });
      x += widths[index];
    });
    doc.y = y + rowH;
  });
}

export function buildPdfReport(report: ModeratorReport) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 36,
      bufferPages: true,
      info: { Title: `${report.target.name} report` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(0, 0, doc.page.width, 72).fill("#0f4c5c");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16).text("Medico Support", 36, 20);
    doc.font("Helvetica").fontSize(10).fillColor("#d7e6ea").text("Moderator workload report", 36, 42);
    doc.y = 92;

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#16313d").text(report.target.name);
    doc.moveDown(0.35);
    kv(doc, "Email", report.target.email);
    kv(doc, "Phone", report.target.phone);
    kv(doc, "Status", report.target.isActive ? "Active" : "Disabled");
    kv(doc, "Generated", report.generated);

    sectionTitle(doc, "Summary");
    const stats: Array<[string, number]> = [
      ["Students", report.studentCount],
      ["Supports", report.supportCount],
      ["Pending", report.pending],
      ["In progress", report.inProgress],
      ["Completed", report.completed],
      ["Cancelled", report.cancelled],
    ];
    const boxW = (pageWidth - 20) / 3;
    const startY = doc.y;
    stats.forEach(([label, value], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = doc.page.margins.left + col * (boxW + 10);
      const y = startY + row * 46;
      doc.roundedRect(x, y, boxW, 38, 4).fill("#f4f7f8");
      doc.font("Helvetica").fontSize(8).fillColor("#5b6770").text(label, x + 10, y + 7);
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f4c5c").text(String(value), x + 10, y + 18);
    });
    doc.y = startY + 102;

    sectionTitle(doc, "Placement");
    drawTable(
      doc,
      ["Type", "Name", "Students"],
      [
        ...report.branches.map(([name, count]) => ["Branch", name, String(count)]),
        ...report.groups.map(([name, count]) => ["Group", name, String(count)]),
        ...report.batches.map(([name, count]) => ["Batch", name, String(count)]),
      ],
      [90, 330, 85]
    );

    sectionTitle(doc, "Supports");
    drawTable(
      doc,
      ["Student", "Roll", "Type", "Status", "Assigned", "Last comment"],
      report.supportRows.map((row) => [
        row.student,
        row.roll,
        row.supportType,
        row.status,
        row.assigned,
        row.lastComment,
      ]),
      [90, 70, 80, 60, 80, 125]
    );

    sectionTitle(doc, "Comments");
    if (!report.commentRows.length) {
      doc.font("Helvetica").fontSize(9).fillColor("#5b6770").text("No comments yet.");
    } else {
      drawTable(
        doc,
        ["Student", "Roll", "Type", "When", "By", "Comment"],
        report.commentRows.map((row) => [row.student, row.roll, row.supportType, row.when, row.by, row.text]),
        [80, 58, 70, 78, 70, 149]
      );
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor("#7b8790").text(
        `Page ${i - range.start + 1} of ${range.count}`,
        36,
        doc.page.height - 28,
        { width: pageWidth, align: "right" }
      );
    }

    doc.end();
  });
}
