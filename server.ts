import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import Stripe from "stripe";
import puppeteer from "puppeteer";

dotenv.config();

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), "db");

// Stripe initialization helper
let stripeInstance: Stripe | null = null;
const getStripe = () => {
  if (!stripeInstance && process.env.STRIPE_SECRET_KEY) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
};

// Initialize data directory with seed data if empty
async function initDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const filesMapping = {
      "settings.json": [{
        id: "default",
        companyName: "Zeone Software Solutions",
        gstin: "27AAAAA0000A1Z5",
        address: "123 Tech Park, Phase II, Pune, MH 411001",
        phone: "+91 98765 43210",
        email: "billing@zeone.io",
        bankName: "HDFC Bank",
        accountNumber: "50100012345678",
        ifscCode: "HDFC0001234",
        upiId: "zeone@okaxis",
        terms: "1. Please pay within 7 days.\n2. Goods once sold will not be taken back.",
        autoUploadToDrive: false
      }],
      "clients.json": [
        { id: "c1", name: "Acme Corp", gstin: "27BBBBB1111B1Z2", email: "info@acme.com", phone: "020-22223333", address: "Plot 4, MIDC, Mumbai" },
        { id: "c2", name: "Star Retail", gstin: "27CCCCC2222C1Z3", email: "contact@star.in", phone: "9888877777", address: "G-12, City Mall, Bangalore" }
      ],
      "items.json": [
        { id: "i1", name: "Software License", hsn: "9973", price: 15000, gstRate: 18, stock: 999, unit: "Unit" },
        { id: "i2", name: "Professional Services", hsn: "9983", price: 5000, gstRate: 18, stock: 1, unit: "Hour" },
        { id: "i3", name: "Support Package", hsn: "9987", price: 2000, gstRate: 18, stock: 100, unit: "Month" }
      ],
      "invoices.json": [],
      "expenses.json": [
        { id: "e1", date: "2024-03-15", description: "Office Rent", amount: 25000, category: "Rent", itcClaimed: true },
        { id: "e2", date: "2024-03-20", description: "Cloud Hosting", amount: 4500, category: "Utilities", itcClaimed: true }
      ]
    };

    for (const [file, defaultData] of Object.entries(filesMapping)) {
      const filePath = path.join(DATA_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.size <= 2) { // Just [] or empty
          await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
        }
      } catch {
        await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
      }
    }
  } catch (err) {
    console.error("Error initializing DB:", err);
  }
}

// AI Service
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Helper for file operations
const readJson = async (file: string) => JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf-8"));
const writeJson = async (file: string, data: any) => fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));

// Google OAuth State
let googleTokens: any = null;

// Start Server
async function startServer() {
  await initDb();

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // --- API Routes ---
  
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      service: "Zeone GST Billing API"
    });
  });

  app.get("/api/data/:file", async (req, res) => {
    try {
      const file = `${req.params.file}.json`;
      const data = await readJson(file);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to read data" });
    }
  });

  app.post("/api/data/:file", async (req, res) => {
    try {
      const file = `${req.params.file}.json`;
      const data = await readJson(file);
      const newItem = { ...req.body, id: Date.now().toString() };
      data.push(newItem);
      await writeJson(file, data);
      res.json(newItem);
    } catch (err) {
      res.status(500).json({ error: "Failed to save data" });
    }
  });

  app.post("/api/data/:file/bulk", async (req, res) => {
    try {
      const file = `${req.params.file}.json`;
      const data = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: "Data must be an array" });
      }
      await writeJson(file, data);
      res.json({ status: "ok", count: data.length });
    } catch (err) {
      res.status(500).json({ error: "Failed to bulk save data" });
    }
  });

  app.put("/api/data/:file/:id", async (req, res) => {
    try {
      const file = `${req.params.file}.json`;
      let data = await readJson(file);
      data = data.map((item: any) => item.id === req.params.id ? { ...item, ...req.body } : item);
      await writeJson(file, data);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to update data" });
    }
  });

  app.delete("/api/data/:file/:id", async (req, res) => {
    try {
      const file = `${req.params.file}.json`;
      let data = await readJson(file);
      data = data.filter((item: any) => item.id !== req.params.id);
      await writeJson(file, data);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete data" });
    }
  });

  app.post("/api/ai/categorize", async (req, res) => {
    if (!genAI) return res.status(503).json({ error: "Gemini API key not configured" });
    try {
      const { description } = req.body;
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Categorize this business expense: "${description}". Return only the category name from this list: Inventory, Travel, Rent, Utilities, Marketing, Legal, Softwares, Office Supplies, Meals, Misc.`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      res.json({ category: response.text().trim() });
    } catch (err) {
      res.status(500).json({ error: "AI failed to categorize" });
    }
  });

  app.get("/api/auth/google/url", (req, res) => {
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const options = {
      redirect_uri: process.env.GOOGLE_REDIRECT_URL || `${req.protocol}://${req.get('host')}/auth/google/callback`,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/gmail.send"
      ].join(" "),
    };
    const qs = new URLSearchParams(options);
    res.json({ url: `${rootUrl}?${qs.toString()}` });
  });

  app.get("/auth/google/callback", async (req, res) => {
    const code = req.query.code as string;
    const rootUrl = "https://oauth2.googleapis.com/token";
    const options = {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URL || `${req.protocol}://${req.get('host')}/auth/google/callback`,
      grant_type: "authorization_code",
    };

    try {
      const response = await fetch(rootUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(options),
      });
      const tokens = await response.json();
      googleTokens = tokens;
      res.send(`<html><body><script>window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');window.close();</script></body></html>`);
    } catch (err) {
      res.status(500).send("Auth failed");
    }
  });

  app.post("/api/gmail/send", async (req, res) => {
    const { to, subject, body, fileName, content, accessToken } = req.body;
    try {
      const boundary = "boundary_" + Date.now();
      const mailBody = [
        `To: ${to}`,
        `Subject: ${subject}`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        ``,
        body,
        ``,
        `--${boundary}`,
        `Content-Type: application/pdf`,
        `Content-Disposition: attachment; filename="${fileName}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        content,
        `--${boundary}--`
      ].join("\r\n");

      const encodedMail = Buffer.from(mailBody).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: encodedMail })
      });
      const result = await response.json();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Email failed to send" });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
    try {
      const { invoiceId, items, customerEmail, currency = 'inr' } = req.body;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map((item: any) => ({
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: item.name },
            unit_amount: Math.round((Number(item.total) || 0) * 100),
          },
          quantity: Number(item.quantity) || 1,
        })),
        mode: 'payment',
        success_url: `${req.protocol}://${req.get('host')}/invoices?paid=true&id=${invoiceId}`,
        cancel_url: `${req.protocol}://${req.get('host')}/invoices?paid=false&id=${invoiceId}`,
        customer_email: customerEmail || undefined,
      });
      res.json({ url: session.url });
    } catch (err) {
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // PDF Generation using Puppeteer
  app.post("/api/pdf/generate", async (req, res) => {
    const { html, filename } = req.body;
    if (!html) return res.status(400).json({ error: "HTML content is required" });

    let browser;
    try {
      console.log(`Generating PDF: ${filename}`);
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      const buffer = Buffer.from(pdf);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': buffer.length,
        'Content-Disposition': `attachment; filename="${filename || 'invoice.pdf'}"`
      });
      res.end(buffer);
    } catch (err: any) {
      console.error("PDF Error:", err);
      res.status(500).json({ error: "Failed to generate PDF", details: err.message });
    } finally {
      if (browser) await browser.close();
    }
  });

  // Catch-all for undefined API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
