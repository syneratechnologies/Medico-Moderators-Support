import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatDateTime } from "@/lib/utils";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";

type SupportDoc = {
  supportType?: unknown;
  assignedModerator?: unknown;
  status?: string;
  assignedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  outcome?: string;
  comments?: unknown;
};

function nameOf(value: unknown) {
  if (typeof value === "object" && value !== null && "name" in value) {
    return String((value as { name?: string }).name ?? "");
  }
  return "";
}

function visibleComments(item: SupportDoc, includePending: boolean) {
  return ((item.comments ?? []) as unknown as Array<Record<string, unknown>>).filter((comment) => {
    if (comment.deleteStatus === "approved") return false;
    if (!includePending && comment.deleteStatus === "pending") return false;
    return true;
  });
}

function reportSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "student";
}

export async function loadStudentReport(id: string) {
  const student = await Student.findById(id).populate("branch group batch").lean();
  if (!student) return null;

  const supports = (await Support.find({ student: id })
    .populate("supportType assignedModerator comments.createdBy")
    .sort({ createdAt: -1 })
    .lean()) as SupportDoc[];

  const supportRows = supports.map((item) => {
    const comments = visibleComments(item, false);
    return {
      supportType: nameOf(item.supportType),
      status: String(item.status ?? ""),
      moderator: nameOf(item.assignedModerator) || "Unassigned",
      assigned: formatDateTime(item.assignedAt ?? item.createdAt),
      completed: formatDateTime(item.completedAt),
      lastComment: String(comments[comments.length - 1]?.text ?? item.outcome ?? ""),
    };
  });

  const commentRows = supports.flatMap((item) =>
    visibleComments(item, true).map((comment) => ({
      supportType: nameOf(item.supportType),
      when: formatDateTime((comment.updatedAt ?? comment.createdAt) as Date | undefined),
      by: nameOf(comment.createdBy) || "Team",
      text: String(comment.text ?? ""),
    }))
  );

  return {
    student: {
      name: String(student.name ?? ""),
      roll: String(student.roll ?? ""),
      serial: String(student.serial ?? ""),
      studentNumber: String(student.studentNumber ?? ""),
      guardianPhone: String(student.guardianPhone ?? ""),
      branch: nameOf(student.branch),
      group: nameOf(student.group),
      batch: nameOf(student.batch),
    },
    generated: formatDateTime(new Date()),
    supportCount: supports.length,
    pending: supports.filter((item) => item.status === "pending").length,
    inProgress: supports.filter((item) => item.status === "in_progress").length,
    completed: supports.filter((item) => item.status === "completed").length,
    cancelled: supports.filter((item) => item.status === "cancelled").length,
    supportRows,
    commentRows,
  };
}

export type StudentReport = NonNullable<Awaited<ReturnType<typeof loadStudentReport>>>;

export function studentReportSlug(report: StudentReport) {
  return reportSlug(`${report.student.name}-${report.student.roll}`) || "student";
}

export async function buildStudentExcel(report: StudentReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Medico Support";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Profile");
  summary.columns = [{ width: 28 }, { width: 42 }];
  summary.addRows([
    ["Student report", report.student.name],
    ["Roll", report.student.roll],
    ["Serial", report.student.serial],
    ["S-Number", report.student.studentNumber],
    ["G-Number", report.student.guardianPhone],
    ["Branch", report.student.branch],
    ["Group", report.student.group],
    ["Batch", report.student.batch],
    ["Generated", report.generated],
    [],
    ["Supports", report.supportCount],
    ["Pending", report.pending],
    ["In progress", report.inProgress],
    ["Completed", report.completed],
    ["Cancelled", report.cancelled],
  ]);

  const cases = workbook.addWorksheet("Supports");
  cases.columns = [22, 14, 22, 22, 22, 46].map((width) => ({ width }));
  cases.addRow(["Support type", "Status", "Moderator", "Assigned", "Completed", "Last comment"]);
  for (const row of report.supportRows) {
    cases.addRow([row.supportType, row.status, row.moderator, row.assigned, row.completed, row.lastComment]);
  }

  const notes = workbook.addWorksheet("Comments");
  notes.columns = [22, 22, 18, 50].map((width) => ({ width }));
  notes.addRow(["Support type", "When", "By", "Comment"]);
  for (const row of report.commentRows) {
    notes.addRow([row.supportType, row.when, row.by, row.text]);
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
  doc
    .strokeColor("#d6dde3")
    .lineWidth(0.8)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
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

function drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], widths: number[]) {
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

export function buildStudentPdf(report: StudentReport) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 36,
      bufferPages: true,
      info: { Title: `${report.student.name} report` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(0, 0, doc.page.width, 72).fill("#0f4c5c");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16).text("Medico Support", 36, 20);
    doc.font("Helvetica").fontSize(10).fillColor("#d7e6ea").text("Student support report", 36, 42);
    doc.y = 92;

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#16313d").text(report.student.name);
    doc.moveDown(0.35);
    kv(doc, "Roll", report.student.roll);
    kv(doc, "Serial", report.student.serial);
    kv(doc, "S-Number", report.student.studentNumber);
    kv(doc, "G-Number", report.student.guardianPhone);
    kv(doc, "Branch", report.student.branch);
    kv(doc, "Group", report.student.group);
    kv(doc, "Batch", report.student.batch);
    kv(doc, "Generated", report.generated);

    sectionTitle(doc, "Summary");
    const stats: Array<[string, number]> = [
      ["Supports", report.supportCount],
      ["Pending", report.pending],
      ["In progress", report.inProgress],
      ["Completed", report.completed],
      ["Cancelled", report.cancelled],
    ];
    const boxW = (pageWidth - 16) / 3;
    const startY = doc.y;
    stats.forEach(([label, value], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = doc.page.margins.left + col * (boxW + 8);
      const y = startY + row * 46;
      doc.roundedRect(x, y, boxW, 38, 4).fill("#f4f7f8");
      doc.font("Helvetica").fontSize(8).fillColor("#5b6770").text(label, x + 10, y + 7);
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f4c5c").text(String(value), x + 10, y + 18);
    });
    doc.y = startY + 102;

    sectionTitle(doc, "Supports");
    if (!report.supportRows.length) {
      doc.font("Helvetica").fontSize(9).fillColor("#5b6770").text("No supports yet.");
    } else {
      drawTable(
        doc,
        ["Support type", "Status", "Moderator", "Assigned", "Last comment"],
        report.supportRows.map((row) => [row.supportType, row.status, row.moderator, row.assigned, row.lastComment]),
        [110, 70, 100, 90, 135]
      );
    }

    sectionTitle(doc, "Comments");
    if (!report.commentRows.length) {
      doc.font("Helvetica").fontSize(9).fillColor("#5b6770").text("No comments yet.");
    } else {
      drawTable(
        doc,
        ["Support type", "When", "By", "Comment"],
        report.commentRows.map((row) => [row.supportType, row.when, row.by, row.text]),
        [110, 90, 90, 215]
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
