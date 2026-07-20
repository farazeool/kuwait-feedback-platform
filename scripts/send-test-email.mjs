import nodemailer from "nodemailer";

const recipient = process.argv[2];
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  throw new Error("Usage: npm run email:send-test -- recipient@example.test");
}
if (process.env.ALLOW_EMAIL_TEST_SEND !== "true") {
  throw new Error("Set ALLOW_EMAIL_TEST_SEND=true for this one explicit test send.");
}
const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"];
if (required.some((key) => !process.env[key])) throw new Error("SMTP test configuration is incomplete.");

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD },
  connectionTimeout: 5_000,
  socketTimeout: 10_000,
});

await transport.sendMail({
  from: { address: process.env.SMTP_FROM_EMAIL, name: process.env.SMTP_FROM_NAME || "Kuwait Feedback Platform" },
  to: recipient,
  subject: "Kuwait Feedback Platform delivery check",
  text: "This is an explicitly requested operational email delivery check.",
  html: "<p>This is an explicitly requested operational email delivery check.</p>",
});
console.log("Test email accepted by the configured SMTP provider.");
