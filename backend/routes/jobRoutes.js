const express = require("express");
const router = express.Router();

const {
  createJob,
  getMyJobs,
  getJobById,
  hireWorker,
  completeJob,
  jobCheckIn,
} = require("../controllers/jobsController");

const { verifyToken } = require("../middleware/authMiddleware");

// All job routes require an authenticated user
router.use(verifyToken);

router.post("/", createJob);
router.get("/", getMyJobs);
router.get("/:id", getJobById);
router.put("/:id/hire", hireWorker);
router.put("/:id/complete", completeJob);
router.post("/:id/checkin", jobCheckIn);

module.exports = router;
