type CommentLike = {
  text?: string;
  createdBy?: unknown;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deleteStatus?: string | null;
  deleteRequestedBy?: unknown;
  deleteRequestedAt?: Date | null;
};

export function isApprovedDelete(comment: CommentLike) {
  return comment.deleteStatus === "approved";
}

export function isPendingDelete(comment: CommentLike) {
  return comment.deleteStatus === "pending";
}

type SupportLike = {
  comments?: CommentLike[] | null;
  outcome?: string;
  createdAt?: Date;
  updatedAt?: Date;
  completedBy?: unknown;
  createdBy?: unknown;
};

export function hydrateComments(support: SupportLike): CommentLike[] {
  const comments = Array.isArray(support.comments)
    ? support.comments.filter((item) => String(item?.text ?? "").trim() && !isApprovedDelete(item))
    : [];
  if (comments.length) return comments;
  const outcome = String(support.outcome ?? "").trim();
  if (!outcome) return [];
  return [
    {
      text: outcome,
      createdBy: support.completedBy ?? support.createdBy,
      createdAt: support.updatedAt ?? support.createdAt,
    },
  ];
}

export function persistComments(support: unknown) {
  const doc = support as SupportLike & { comments?: CommentLike[] };
  const current = Array.isArray(doc.comments) ? doc.comments : [];
  if (!current.length && String(doc.outcome ?? "").trim()) {
    doc.comments = hydrateComments(doc);
  } else if (!Array.isArray(doc.comments)) {
    doc.comments = [];
  }
  return doc;
}

export function lastCommentText(support: SupportLike) {
  const comments = hydrateComments(support).filter((item) => !isPendingDelete(item));
  return comments[comments.length - 1]?.text?.trim() ?? "";
}
