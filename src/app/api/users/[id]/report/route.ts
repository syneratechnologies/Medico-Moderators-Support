import { jsonError, withAuth } from "@/lib/api";
import { buildExcelReport, buildPdfReport, loadModeratorReport, reportSlug } from "@/lib/moderator-report";
import { User } from "@/models/User";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;
  const { id } = await context.params;

  const target = await User.findById(id).lean();
  if (!target) return jsonError("User not found", 404);
  if (user.role === "manager" && target.role !== "moderator") {
    return jsonError("Forbidden", 403);
  }

  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const report = await loadModeratorReport(id);
  if (!report) return jsonError("User not found", 404);

  const slug = reportSlug(report.target.name);
  if (format === "pdf") {
    const buffer = await buildPdfReport(report);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}-report.pdf"`,
      },
    });
  }

  const buffer = await buildExcelReport(report);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}-report.xlsx"`,
    },
  });
}
