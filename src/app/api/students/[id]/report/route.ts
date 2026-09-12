import { jsonError, withAuth } from "@/lib/api";
import { buildStudentExcel, buildStudentPdf, loadStudentReport, studentReportSlug } from "@/lib/student-report";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth();
  if (error) return error;
  const { id } = await context.params;

  const student = await Student.findById(id).lean();
  if (!student) return jsonError("Student not found", 404);

  if (user.role === "moderator") {
    const assigned = await Support.exists({ student: id, assignedModerator: user.id });
    if (!assigned) return jsonError("Forbidden", 403);
  }

  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const report = await loadStudentReport(id);
  if (!report) return jsonError("Student not found", 404);

  const slug = studentReportSlug(report);
  if (format === "pdf") {
    const buffer = await buildStudentPdf(report);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}-report.pdf"`,
      },
    });
  }

  const buffer = await buildStudentExcel(report);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}-report.xlsx"`,
    },
  });
}
