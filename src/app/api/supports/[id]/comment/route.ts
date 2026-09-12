import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { serializeSupport } from "@/lib/serializers";
import { persistComments } from "@/lib/support-comments";
import { Support } from "@/models/Support";

const schema = z.object({
  text: z.string().trim().min(1, "Comment is required").optional(),
  outcome: z.string().trim().min(1, "Comment is required").optional(),
  complete: z.boolean().optional(),
});

const deleteSchema = z.object({
  commentId: z.string().min(1),
});

const reviewSchema = z.object({
  commentId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
});

const populate = [
  { path: "student", populate: [{ path: "branch" }, { path: "group" }, { path: "batch" }] },
  { path: "supportType" },
  { path: "assignedModerator" },
  { path: "createdBy" },
  { path: "completedBy" },
  { path: "comments.createdBy" },
  { path: "comments.deleteRequestedBy" },
];

function commentDoc(support: { comments?: Array<{ id?: string; _id?: unknown }> }, commentId: string) {
  const comments = support.comments ?? [];
  const byId = comments.find((item) => String(item.id ?? item._id) === commentId);
  if (byId) return byId;
  if (commentId.startsWith("legacy-")) {
    const index = Number(commentId.replace("legacy-", ""));
    return Number.isInteger(index) ? comments[index] ?? null : null;
  }
  return null;
}

function canComment(user: { id: string; role: string }, support: { assignedModerator?: unknown }) {
  if (user.role === "super_admin" || user.role === "manager") return true;
  if (user.role === "moderator") return String(support.assignedModerator ?? "") === user.id;
  return false;
}

async function loadSupport(id: string) {
  const support = await Support.findById(id);
  if (!support) return null;
  persistComments(support);
  return support;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth();
  if (error) return error;
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const text = parsed.success ? (parsed.data.text ?? parsed.data.outcome ?? "").trim() : "";
  if (!text) return jsonError("Comment cannot be empty");

  const support = await loadSupport(id);
  if (!support) return jsonError("Support not found", 404);
  if (!canComment(user, support)) return jsonError("Forbidden", 403);

  support.comments = support.comments ?? [];
  support.comments.push({
    text,
    createdBy: user.id as never,
    createdAt: new Date(),
  });
  support.outcome = text;
  if (support.description == null) support.description = "";
  if (parsed.data?.complete && support.status !== "cancelled") {
    support.status = "completed";
    support.completedAt = new Date();
    support.completedBy = user.id as never;
  }
  await support.save();
  await support.populate(populate);

  await logActivity({
    user,
    action: parsed.data?.complete ? "Added comment and completed support" : "Added support comment",
    targetType: "support",
    targetId: id,
    newValue: { text, status: support.status },
  });

  return NextResponse.json(serializeSupport(support.toObject() as Record<string, unknown>));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth();
  if (error) return error;
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const text = parsed.success ? (parsed.data.text ?? parsed.data.outcome ?? "").trim() : "";
  if (!text) return jsonError("Comment cannot be empty");

  const support = await loadSupport(id);
  if (!support) return jsonError("Support not found", 404);
  if (!canComment(user, support)) return jsonError("Forbidden", 403);

  support.comments = support.comments ?? [];
  const last = [...support.comments].reverse().find((item) => item.deleteStatus !== "pending" && item.deleteStatus !== "approved");
  if (last) {
    last.text = text;
    last.updatedAt = new Date();
  } else {
    support.comments.push({
      text,
      createdBy: user.id as never,
      createdAt: new Date(),
    });
  }
  support.outcome = text;
  if (support.description == null) support.description = "";
  if (parsed.data?.complete && support.status !== "cancelled") {
    support.status = "completed";
    support.completedAt = new Date();
    support.completedBy = user.id as never;
  }
  await support.save();
  await support.populate(populate);

  await logActivity({
    user,
    action: parsed.data?.complete ? "Updated comment and completed support" : "Edited last support comment",
    targetType: "support",
    targetId: id,
    newValue: { text, status: support.status },
  });

  return NextResponse.json(serializeSupport(support.toObject() as Record<string, unknown>));
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth();
  if (error) return error;
  const { id } = await context.params;
  const parsed = deleteSchema.safeParse({
    commentId: new URL(request.url).searchParams.get("commentId"),
  });
  if (!parsed.success) return jsonError("Comment is required");

  try {
    const support = await loadSupport(id);
    if (!support) return jsonError("Support not found", 404);
    if (!canComment(user, support)) return jsonError("Forbidden", 403);
    if (support.isModified("comments")) await support.save();

    const comment = commentDoc(support, parsed.data.commentId) as {
      text?: string;
      deleteStatus?: string;
      _id?: unknown;
      id?: string;
    } | null;
    if (!comment) return jsonError("Comment not found", 404);
    if (comment.deleteStatus === "pending") return jsonError("This comment is already waiting for approval");
    if (comment.deleteStatus === "approved") return jsonError("Comment already deleted");

    const commentId = String(comment.id ?? comment._id ?? "");
    if (!commentId || commentId.startsWith("legacy-")) {
      return jsonError("Save this comment first, then delete it");
    }

    await Support.updateOne(
      { _id: id, "comments._id": commentId },
      {
        $set: {
          "comments.$.deleteStatus": "pending",
          "comments.$.deleteRequestedBy": user.id,
          "comments.$.deleteRequestedAt": new Date(),
        },
      }
    );

    const fresh = await Support.findById(id).populate(populate);
    if (!fresh) return jsonError("Support not found", 404);

    await logActivity({
      user,
      action: "Requested comment delete",
      targetType: "support",
      targetId: id,
      newValue: { commentId, text: comment.text },
    });

    return NextResponse.json(serializeSupport(fresh.toObject() as Record<string, unknown>));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not request delete";
    return jsonError(message, 500);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;
  const { id } = await context.params;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Approve or reject is required");

  try {
    const raw = (await Support.collection.findOne({
      _id: new mongoose.Types.ObjectId(id),
    })) as Record<string, unknown> | null;
    if (!raw) return jsonError("Support not found", 404);

    const comments = (raw.comments ?? []) as Array<Record<string, unknown>>;
    const waiting = comments.filter(
      (item) => item.deleteStatus === "pending" || Boolean(item.deleteRequestedAt)
    );
    const comment =
      waiting.find((item) => String(item._id) === parsed.data.commentId) ??
      waiting.find((item) => String(item.id ?? "") === parsed.data.commentId) ??
      (waiting.length === 1 ? waiting[0] : null);
    if (!comment) return jsonError("This comment is not waiting for approval");

    const commentId = String(comment._id);
    if (parsed.data.decision === "approve") {
      const remaining = comments.filter(
        (item) => String(item._id) !== commentId && item.deleteStatus !== "pending" && item.deleteStatus !== "approved"
      );
      await Support.updateOne(
        { _id: id },
        {
          $pull: { comments: { _id: commentId } },
          $set: { outcome: String(remaining[remaining.length - 1]?.text ?? "") },
        }
      );
    } else {
      await Support.updateOne(
        { _id: id, "comments._id": commentId },
        {
          $set: {
            "comments.$.deleteStatus": "rejected",
            "comments.$.deleteReviewedBy": user.id,
            "comments.$.deleteReviewedAt": new Date(),
          },
          $unset: {
            "comments.$.deleteRequestedBy": 1,
            "comments.$.deleteRequestedAt": 1,
          },
        }
      );
    }

    const fresh = await Support.findById(id).populate(populate).lean();
    if (!fresh) return jsonError("Support not found", 404);

    await logActivity({
      user,
      action: parsed.data.decision === "approve" ? "Approved comment delete" : "Rejected comment delete",
      targetType: "support",
      targetId: id,
      newValue: { commentId, text: comment.text },
    });

    return NextResponse.json(serializeSupport(fresh as Record<string, unknown>));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not review delete";
    return jsonError(message, 500);
  }
}
