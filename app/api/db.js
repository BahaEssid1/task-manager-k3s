
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "taskmanager",
  user: process.env.DB_USER || "taskmanager_app",
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 3000,
  max: 10,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

module.exports = pool;
