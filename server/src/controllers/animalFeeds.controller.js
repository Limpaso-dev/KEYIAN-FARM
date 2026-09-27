import AnimalFeed from "../models/AnimalFeed.js";

export const createAnimalFeed = async (req, res, next) => {
  try {
    const feed = await AnimalFeed.create(req.body);

    res.status(201).json({
      success: true,
      message: "Animal feed record created",
      data: feed,
    });
  } catch (error) {
    next(error);
  }
};

export const getAnimalFeeds = async (req, res, next) => {
  try {
    const feeds = await AnimalFeed.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: feeds.length,
      data: feeds,
    });
  } catch (error) {
    next(error);
  }
};

export const getAnimalFeedById = async (req, res, next) => {
  try {
    const feed = await AnimalFeed.findById(req.params.id);

    if (!feed) {
      return res.status(404).json({
        success: false,
        message: "Animal feed record not found",
      });
    }

    res.json({
      success: true,
      data: feed,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAnimalFeed = async (req, res, next) => {
  try {
    const feed = await AnimalFeed.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!feed) {
      return res.status(404).json({
        success: false,
        message: "Animal feed record not found",
      });
    }

    res.json({
      success: true,
      message: "Animal feed updated",
      data: feed,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAnimalFeed = async (req, res, next) => {
  try {
    const feed = await AnimalFeed.findByIdAndDelete(
      req.params.id
    );

    if (!feed) {
      return res.status(404).json({
        success: false,
        message: "Animal feed record not found",
      });
    }

    res.json({
      success: true,
      message: "Animal feed deleted",
    });
  } catch (error) {
    next(error);
  }
};