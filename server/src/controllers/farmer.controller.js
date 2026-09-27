import Farmer from "../models/Farmer.js";

// CREATE
export const createFarmer = async (req, res, next) => {
  try {
    const farmer = await Farmer.create(req.body);

    res.status(201).json({
      success: true,
      message: "Farmer created successfully",
      data: farmer,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL
export const getFarmers = async (req, res, next) => {
  try {
    const farmers = await Farmer.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: farmers.length,
      data: farmers,
    });
  } catch (error) {
    next(error);
  }
};

// GET ONE
export const getFarmerById = async (req, res, next) => {
  try {
    const farmer = await Farmer.findById(req.params.id);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer not found",
      });
    }

    res.json({
      success: true,
      data: farmer,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE
export const updateFarmer = async (req, res, next) => {
  try {
    const farmer = await Farmer.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer not found",
      });
    }

    res.json({
      success: true,
      message: "Farmer updated successfully",
      data: farmer,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE
export const deleteFarmer = async (req, res, next) => {
  try {
    const farmer = await Farmer.findByIdAndDelete(req.params.id);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer not found",
      });
    }

    res.json({
      success: true,
      message: "Farmer deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};