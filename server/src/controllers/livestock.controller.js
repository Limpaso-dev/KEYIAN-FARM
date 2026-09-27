import Livestock from "../models/Livestock.js";

// CREATE
export const createLivestock = async (req, res, next) => {
  try {
    const livestock = await Livestock.create(req.body);

    const populatedLivestock = await Livestock.findById(
      livestock._id
    ).populate(
      "farmer",
      "firstName lastName membershipNumber phone"
    );

    res.status(201).json({
      success: true,
      message: "Livestock record created successfully",
      livestock: populatedLivestock,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL
export const getLivestock = async (req, res, next) => {
  try {
    const livestock = await Livestock.find()
      .populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: livestock.length,
      livestock,
    });
  } catch (error) {
    next(error);
  }
};

// GET ONE
export const getLivestockById = async (req, res, next) => {
  try {
    const livestock = await Livestock.findById(
      req.params.id
    ).populate(
      "farmer",
      "firstName lastName membershipNumber phone"
    );

    if (!livestock) {
      return res.status(404).json({
        success: false,
        message: "Livestock record not found",
      });
    }

    res.status(200).json({
      success: true,
      livestock,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE
export const updateLivestock = async (req, res, next) => {
  try {
    const livestock = await Livestock.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).populate(
      "farmer",
      "firstName lastName membershipNumber phone"
    );

    if (!livestock) {
      return res.status(404).json({
        success: false,
        message: "Livestock record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Livestock updated successfully",
      livestock,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE
export const deleteLivestock = async (req, res, next) => {
  try {
    const livestock = await Livestock.findByIdAndDelete(
      req.params.id
    );

    if (!livestock) {
      return res.status(404).json({
        success: false,
        message: "Livestock record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Livestock deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};