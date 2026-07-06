import cors from "cors";
import "dotenv/config";
import express from "express";
import { resolveCompany } from "./middleware/company.js";
import { sanitizeTenantRequestBody } from "./middleware/tenantInput.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import cartRoutes from "./routes/cart.js";
import companyRoutes from "./routes/company.js";
import customModuleRoutes from "./routes/customModules.js";
import employeeRoutes from "./routes/employee.js";
import homeOfferRoutes from "./routes/homeOffers.js";
import orderRoutes from "./routes/orders.js";
import platformRoutes from "./routes/platform.js";
import productRoutes from "./routes/products.js";
import { adminProductSchemaRouter, publicProductSchemaRouter } from "./routes/productSchema.js";
import reviewRoutes from "./routes/reviews.js";
import uploadRoutes, { uploadsDir } from "./routes/uploads.js";
import workSessionRoutes from "./routes/workSessions.js";
import invoiceRoutes from "./routes/invoices.js";
import { publicRouter as deliveryPublicRouter, adminRouter as deliveryAdminRouter } from "./routes/deliveryZones.js";
import activityLogRoutes from "./routes/activityLog.js";
import reportsRoutes from "./routes/reports.js";
import websiteMediaRoutes from "./routes/websiteMedia.js";

const app = express();
const port = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === "production";
const localDevelopmentOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
];
const existingEbFrontendOrigin = "https://eb-chemical-full.vercel.app";

function normalizeOrigin(origin = "") {
  return origin.trim().replace(/\/+$/, "");
}

function parseAllowedOrigins(value = "") {
  return [...new Set(value.split(",").map(normalizeOrigin).filter(Boolean))];
}

const configuredOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
const fallbackFrontendOrigin = normalizeOrigin(process.env.FRONTEND_ORIGIN);
const deploymentOrigins = configuredOrigins.length
  ? configuredOrigins
  : [fallbackFrontendOrigin || existingEbFrontendOrigin, existingEbFrontendOrigin];

if (deploymentOrigins.includes("*")) {
  throw new Error("Wildcard CORS origins are not supported. Configure exact frontend origins.");
}

const allowedOrigins = new Set([
  ...deploymentOrigins,
  ...(!isProduction ? localDevelopmentOrigins : []),
]);

app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      return callback(null, allowedOrigins.has(normalizeOrigin(origin)));
    },
    credentials: true,
  }),
);
app.use("/uploads", express.static(uploadsDir));
app.use(express.json({ limit: "1mb" }));
app.use(sanitizeTenantRequestBody);
app.use(resolveCompany);
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "eb-chemical-backend" });
});

app.use("/api/company", companyRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/products", productRoutes);
app.use("/api/product-schema", publicProductSchemaRouter);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/home-offers", homeOfferRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/admin/custom-modules", customModuleRoutes);
app.use("/api/admin/product-schema", adminProductSchemaRouter);
app.use("/api/admin/invoices", invoiceRoutes);
app.use("/api/admin/delivery-zones", deliveryAdminRouter);
app.use("/api/admin", adminRoutes);
app.use("/api/delivery-zones", deliveryPublicRouter);
app.use("/api/admin/activity-log", activityLogRoutes);
app.use("/api/admin/reports", reportsRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/work-sessions", workSessionRoutes);
app.use("/api/website-media", websiteMediaRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "API route not found." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`EB Chemical API running on http://0.0.0.0:${port}`);
});
