export function reviewComment(review, language = "en") {
  const comment = review?.comment;
  if (!comment) return "";
  if (typeof comment === "string") return comment;
  return String(comment[language] || comment.en || comment.ar || "").trim();
}

export function reviewProductLabel(review, products = [], language = "en") {
  const named = String(review?.productName || review?.relatedProductName || "").trim();
  if (named) return named;
  const productId = String(review?.productId || "").trim();
  if (!productId) return "";
  const product = products.find((item) => String(item.id) === productId);
  if (!product) return productId;
  const name = product.name;
  if (name && typeof name === "object") return name[language] || name.en || name.ar || productId;
  return String(name || productId);
}

export function reviewStatusOf(review) {
  if (review?.status) return String(review.status).toLowerCase();
  if (review?.isApproved === false) return "rejected";
  if (review?.isActive === false) return "hidden";
  return "approved";
}

export function filterReviews(rows, { query = "", status = "all", type = "all", rating = "all" } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const needle = String(query || "").trim().toLowerCase();
  const statusFilter = String(status || "all").toLowerCase();
  const typeFilter = String(type || "all").toLowerCase();
  const ratingFilter = String(rating || "all");
  return list.filter((review) => {
    if (statusFilter !== "all" && reviewStatusOf(review) !== statusFilter) return false;
    if (typeFilter !== "all" && String(review?.type || "").toLowerCase() !== typeFilter) return false;
    if (ratingFilter !== "all" && String(review?.rating || "") !== ratingFilter) return false;
    if (!needle) return true;
    const haystack = [
      review?.customerName,
      reviewComment(review, "en"),
      reviewComment(review, "ar"),
      review?.productName,
      review?.relatedProductName,
      review?.employeeName,
      review?.id,
    ].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

export const REVIEW_COPY = {
  en: {
    title: "Reviews",
    subtitle: "Moderate real tenant reviews from the existing reviews API.",
    search: "Search reviewer, comment, or product",
    status: "Status",
    type: "Type",
    rating: "Rating",
    reviewer: "Reviewer",
    review: "Review",
    product: "Product",
    created: "Created",
    actions: "Actions",
    all: "All",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    hidden: "Hidden",
    website: "Website",
    store: "Store",
    site: "Site",
    productType: "Product",
    order: "Order",
    employee: "Employee",
    loading: "Loading reviews…",
    loadFailed: "Reviews could not be loaded",
    retry: "Retry",
    empty: "No reviews yet",
    emptyText: "Customer and staff reviews will appear here when they exist for this company.",
    noMatches: "No reviews match these filters.",
    clear: "Clear filters",
    forbidden: "You do not have permission to view reviews.",
    readOnly: "View only — you do not have permission to moderate reviews.",
    notFound: "Review not found.",
    detail: "Review details",
    close: "Close",
    approve: "Approve",
    reject: "Reject",
    hide: "Hide",
    pendingAction: "Mark pending",
    delete: "Delete",
    edit: "Edit",
    save: "Save",
    create: "Add review",
    reply: "Reply",
    createTitle: "Add review",
    customerName: "Reviewer name",
    commentEn: "Comment (English)",
    commentAr: "Comment (Arabic)",
    cancel: "Cancel",
    confirmDelete: "Delete this review? This cannot be undone.",
    confirmDeleteAction: "Delete review",
    replyUnsupported: "Replying to reviewers is not connected. No review-reply API exists.",
    stars: (value) => `${value} stars`,
    createdNotice: "Review saved.",
    moderatedNotice: "Review status updated.",
    deletedNotice: "Review deleted.",
    requestFailed: "Request failed.",
  },
  ar: {
    title: "المراجعات",
    subtitle: "راجع تقييمات المستأجر الحقيقية من واجهة المراجعات الحالية.",
    search: "ابحث بالمراجع أو التعليق أو المنتج",
    status: "الحالة",
    type: "النوع",
    rating: "التقييم",
    reviewer: "المراجع",
    review: "المراجعة",
    product: "المنتج",
    created: "تاريخ الإنشاء",
    actions: "الإجراءات",
    all: "الكل",
    pending: "قيد المراجعة",
    approved: "مقبولة",
    rejected: "مرفوضة",
    hidden: "مخفية",
    website: "الموقع",
    store: "المتجر",
    site: "الموقع",
    productType: "منتج",
    order: "طلب",
    employee: "موظف",
    loading: "جارٍ تحميل المراجعات…",
    loadFailed: "تعذر تحميل المراجعات",
    retry: "إعادة المحاولة",
    empty: "لا توجد مراجعات بعد",
    emptyText: "ستظهر هنا مراجعات العملاء والموظفين عند توفرها لهذه الشركة.",
    noMatches: "لا توجد مراجعات مطابقة لعوامل التصفية.",
    clear: "مسح عوامل التصفية",
    forbidden: "ليست لديك صلاحية عرض المراجعات.",
    readOnly: "وضع العرض فقط — ليست لديك صلاحية إدارة المراجعات.",
    notFound: "المراجعة غير موجودة.",
    detail: "تفاصيل المراجعة",
    close: "إغلاق",
    approve: "قبول",
    reject: "رفض",
    hide: "إخفاء",
    pendingAction: "تعيين كقيد المراجعة",
    delete: "حذف",
    edit: "تعديل",
    save: "حفظ",
    create: "إضافة مراجعة",
    reply: "رد",
    createTitle: "إضافة مراجعة",
    customerName: "اسم المراجع",
    commentEn: "التعليق (الإنجليزية)",
    commentAr: "التعليق (العربية)",
    cancel: "إلغاء",
    confirmDelete: "حذف هذه المراجعة؟ لا يمكن التراجع عن هذا الإجراء.",
    confirmDeleteAction: "حذف المراجعة",
    replyUnsupported: "الرد على المراجعين غير متصل. لا توجد واجهة رد.",
    stars: (value) => `${value} نجوم`,
    createdNotice: "تم حفظ المراجعة.",
    moderatedNotice: "تم تحديث حالة المراجعة.",
    deletedNotice: "تم حذف المراجعة.",
    requestFailed: "تعذر إكمال الطلب.",
  },
};

export function reviewCopy(language) {
  return REVIEW_COPY[language] || REVIEW_COPY.en;
}

export function reviewStatusLabel(language, status) {
  const copy = reviewCopy(language);
  return copy[reviewStatusOf({ status })] || status || copy.pending;
}

export function reviewTypeLabel(language, type) {
  const copy = reviewCopy(language);
  const key = String(type || "website").toLowerCase();
  if (key === "product") return copy.productType;
  return copy[key] || type || copy.website;
}

export function formatReviewDate(value, language) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(language === "ar" ? "ar" : "en");
}
