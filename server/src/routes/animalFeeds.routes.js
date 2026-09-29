import express from "express";

import {
	createAnimalFeed,
	deleteAnimalFeed,
	getAnimalFeedById,
	getAnimalFeeds,
	updateAnimalFeed,
} from "../controllers/animalFeeds.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(protect, authorizeModule("animalFeeds"));

router.get("/", getAnimalFeeds);
router.get("/:id", getAnimalFeedById);
router.post("/", createAnimalFeed);
router.put("/:id", updateAnimalFeed);
router.delete("/:id", deleteAnimalFeed);

export default router;