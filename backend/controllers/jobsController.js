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

/**
 * Fetches a single job by its ID.
 *
 * @route GET /api/jobs/:id
 * @access Private
 */
const getJobById = async (req, res) => {
  try {
    const jobId = req.params.id;
    const [jobs] = await pool.query("SELECT * FROM jobs WHERE id = ?", [jobId]);

    if (jobs.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json({ job: jobs[0] });
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Assigns a worker to a job and transitions its status to 'ASSIGNED'.
 * The job must already be in 'PAID' status, meaning escrow has been funded
 * before a worker can be hired.
 *
 * @route PUT /api/jobs/:id/hire
 * @access Private (CLIENT)
 */
const hireWorker = async (req, res) => {
  try {
    const jobId = req.params.id;
    const clientId = req.user.id;
    const { worker_id } = req.body;

    const [result] = await pool.query(
      `UPDATE jobs SET worker_id = ?, job_status = 'ASSIGNED' 
         WHERE id = ? AND client_id = ? AND job_status = 'PAID'`,
      [worker_id, jobId, clientId],
    );

    if (result.affectedRows === 0) {
      return res
        .status(400)
        .json({ message: "Job not found, not yours, or escrow not yet paid." });
    }

    res.status(200).json({ message: "Worker hired successfully", jobId });
  } catch (error) {
    console.error("Error hiring worker:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createJob,
  getMyJobs,
  getJobById,
  hireWorker,
};
