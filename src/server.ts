import "dotenv/config";
import app from "./app";
import pool from "./config/database";

const port = Number(process.env.PORT || 3001);

async function startServer(): Promise<void> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database connection error";

    console.error("Failed to connect to database:", message);
    if (message.includes("127.0.0.1") || message.includes("localhost")) {
      console.error(
        [
          "Database host looks local (127.0.0.1). On Railway, MySQL variables exist on the MySQL service only.",
          'Open service "recruitment-ms-be" → Variables → New variable → Reference → select MySQL → add MYSQL_URL',
          "(or MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE).",
          "Also set JWT_SECRET on the backend service.",
        ].join(" ")
      );
    }
    process.exit(1);
  }
}

void startServer();
