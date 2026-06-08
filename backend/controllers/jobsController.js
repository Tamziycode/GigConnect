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

/**
 * Marks an assigned job as completed.
 * Both client and worker must have completed their GPS check-ins first.
 * This is a deadlock prevention measure — neither party can be ghosted
 * after funds are released.
 *
 * @route PUT /api/jobs/:id/complete
 * @access Private (CLIENT)
 */
const completeJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const clientId = req.user.id;

    const [jobs] = await pool.query(
      "SELECT job_status, client_checkin, worker_checkin FROM jobs WHERE id = ? AND client_id = ?",
      [jobId, clientId],
    );

    if (jobs.length === 0) {
      return res
        .status(404)
        .json({ message: "Job not found or unauthorized." });
    }

    if (jobs[0].job_status !== "ASSIGNED") {
      return res
        .status(400)
        .json({ message: "Job must be ASSIGNED to be marked completed." });
    }

    if (!jobs[0].client_checkin || !jobs[0].worker_checkin) {
      return res.status(403).json({
        message:
          "Cannot complete job. Both client and worker must check in first.",
      });
    }

    await pool.query("UPDATE jobs SET job_status = 'COMPLETED' WHERE id = ?", [
      jobId,
    ]);

    res
      .status(200)
      .json({ message: "Job marked as completed. Funds ready for release." });
  } catch (error) {
    console.error("Error completing job:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Records a check-in for either the client or worker on an assigned job.
 *
 * Client check-in: confirms the client is ready for the job to begin.
 * Worker check-in: requires live GPS coordinates and validates that the worker
 * is physically within 200 metres of the job location using the Haversine formula.
 * This prevents workers from falsely confirming attendance remotely.
 *
 * @route POST /api/jobs/:id/checkin
 * @access Private
 */
const jobCheckIn = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.id;
    const role = req.user.role;

    const [jobs] = await pool.query("SELECT * FROM jobs WHERE id = ?", [jobId]);

    if (jobs.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    const job = jobs[0];

    if (job.job_status !== "ASSIGNED") {
      return res
        .status(400)
        .json({ message: "Job must be ASSIGNED before check-in." });
    }

    if (role === "CLIENT") {
      if (job.client_id !== userId) {
        return res
          .status(403)
          .json({ message: "Unauthorized. This is not your job." });
      }

      await pool.query("UPDATE jobs SET client_checkin = TRUE WHERE id = ?", [
        jobId,
      ]);
      return res.status(200).json({ message: "Client check-in confirmed." });
    }

    if (role === "WORKER") {
      if (job.worker_id !== userId) {
        return res
          .status(403)
          .json({ message: "Unauthorized. You are not assigned to this job." });
      }

      const { lat, lng } = req.body;

      if (!lat || !lng) {
        return res.status(400).json({
          message: "Live GPS coordinates required for worker check-in.",
        });
      }

      // Haversine formula computed in SQL to calculate the great-circle distance
      // between the worker's live coordinates and the stored job location.
      // Result is in kilometres; the 6371 constant is Earth's mean radius.
      const distanceQuery = `
        SELECT (
          6371 * acos (
            cos ( radians(?) )
            * cos( radians( lat ) )
            * cos( radians( lng ) - radians(?) )
            + sin ( radians(?) )
            * sin( radians( lat ) )
          )
        ) AS distance
        FROM jobs
        WHERE id = ?
      `;

      const [distResult] = await pool.query(distanceQuery, [
        lat,
        lng,
        lat,
        jobId,
      ]);
      const distanceInKm = distResult[0].distance;

      // Reject check-in if the worker is more than 200 metres from the job site
      if (distanceInKm > 0.2) {
        return res.status(403).json({
          message: "Check-in failed. You are not at the job location.",
          distance_km: distanceInKm.toFixed(2),
        });
      }

      await pool.query("UPDATE jobs SET worker_checkin = TRUE WHERE id = ?", [
        jobId,
      ]);
      return res.status(200).json({
        message: "Worker check-in confirmed. You are within range.",
        distance_km: distanceInKm.toFixed(2),
      });
    }
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ message: "Internal server error during check-in" });
  }
};

module.exports = {
  createJob,
  getMyJobs,
  getJobById,
  hireWorker,
  completeJob,
  jobCheckIn,
};
