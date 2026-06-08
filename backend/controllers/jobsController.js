const pool = require("../db");

/**
 * Creates a new job listing under the authenticated client's account.
 * Status defaults to 'OPEN'; escrow must be funded before a worker can be hired.
 *
 * @route POST /api/jobs
 * @access Private (CLIENT)
 */
const createJob = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { title, job_description, category, location, lat, lng, budget } =
      req.body;

    const [result] = await pool.query(
      `INSERT INTO jobs 
      (client_id, title, job_description, category, location, lat, lng, budget) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, title, job_description, category, location, lat, lng, budget],
    );

    res.status(201).json({
      message: "Job created successfully",
      jobId: result.insertId,
    });
  } catch (error) {
    console.error("Error creating job:", error);
    res
      .status(500)
      .json({ message: "Internal server error while creating job" });
  }
};

/**
 * Returns all jobs associated with the authenticated user.
 * Clients see jobs they posted; workers see jobs they are assigned to.
 *
 * @route GET /api/jobs
 * @access Private
 */
const getMyJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = "";

    if (userRole === "CLIENT") {
      query = "SELECT * FROM jobs WHERE client_id = ? ORDER BY created_at DESC";
    } else {
      query = "SELECT * FROM jobs WHERE worker_id = ? ORDER BY created_at DESC";
    }

    const [jobs] = await pool.query(query, [userId]);

    res.status(200).json({ jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res
      .status(500)
      .json({ message: "Internal server error while fetching jobs" });
  }
};

module.exports = {
  createJob,
  getMyJobs,
};
