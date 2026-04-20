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
    process.exit(1);
  }
}

void startServer();
