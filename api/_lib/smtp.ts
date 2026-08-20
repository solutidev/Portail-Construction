export type Smtp = {
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  from_name?: string;
  from_email?: string;
  secure?: boolean;
};

export function smtpFromEnv(): Smtp {
  return {
    host: process.env.SMTP_HOST || "",
    port: process.env.SMTP_PORT || "587",
    username: process.env.SMTP_USERNAME || "",
    password: process.env.SMTP_PASSWORD || "",
    from_name: process.env.SMTP_FROM_NAME || "FRX Construction",
    from_email: process.env.SMTP_FROM_EMAIL || "",
    secure: process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true",
  };
}

export function mergeSmtp(body: Smtp | undefined, stored: Smtp | undefined): Smtp {
  const env = smtpFromEnv();
  return {
    host: env.host || stored?.host || body?.host || "",
    port: env.port || stored?.port || body?.port || "587",
    username: env.username || stored?.username || "",
    password: env.password || stored?.password || "",
    from_name: env.from_name || stored?.from_name || body?.from_name || "",
    from_email: env.from_email || stored?.from_email || body?.from_email || "",
    secure: env.secure || Boolean(stored?.secure),
  };
}
