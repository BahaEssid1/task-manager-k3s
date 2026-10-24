
require("dotenv").config();

const express = require("express");
const pool = require("./db");

const app = express();
const PORT = Number(process.env.API_PORT || 3000);

app.use(express.json({ limit: "20kb" }));

// Liveness: the API process is running.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "task-manager-api",
  });
});

// Readiness: the database can execute a query.
app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ready", database: "connected" });
  } catch (error) {
    console.error("Readiness check failed:", error.message);
    res.status(503).json({ status: "not_ready" });
  }
});

// List tasks.
app.get("/api/tasks", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, title, description, completed, created_at, updated_at FROM tasks ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get one task.
app.get("/api/tasks/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const result = await pool.query(
      "SELECT id, title, description, completed, created_at, updated_at FROM tasks WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create a task.
app.post("/api/tasks", async (req, res, next) => {
  try {
    const { title, description = "" } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({ error: "Title must be at most 200 characters" });
    }

    if (typeof description !== "string" || description.length > 2000) {
      return res.status(400).json({
        error: "Description must be a string of at most 2000 characters",
      });
    }

    const result = await pool.query(
      `INSERT INTO tasks (title, description)
       VALUES ($1, $2)
       RETURNING id, title, description, completed, created_at, updated_at`,
      [title.trim(), description.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update a task.
app.put("/api/tasks/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, description, completed } = req.body;

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 200
    ) {
      return res.status(400).json({
        error: "A valid title of at most 200 characters is required",
      });
    }

    if (
      typeof description !== "string" ||
      description.length > 2000 ||
      typeof completed !== "boolean"
    ) {
      return res.status(400).json({
        error: "Description must be a string and completed must be a boolean",
      });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = $1,
           description = $2,
           completed = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, title, description, completed, created_at, updated_at`,
      [title.trim(), description.trim(), completed, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete a task.
app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Centralized error handler. Logs go to stdout/stderr.
app.use((error, req, res, next) => {
  console.error("Request failed:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Task Manager API listening on port ${PORT}`);
});

function shutdown() {
  console.log("Shutting down API...");
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
