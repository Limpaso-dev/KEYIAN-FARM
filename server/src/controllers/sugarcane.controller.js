import SugarcaneFarm from "../models/SugarcaneFarm.js";

export const createSugarcaneFarm = async (
  req,
  res,
  next
) => {
  try {
    const farm = await SugarcaneFarm.create(
      req.body
    );

    const populatedFarm =
      await SugarcaneFarm.findById(
        farm._id
      ).populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      );

    res.status(201).json({
      success: true,
      message:
        "Sugarcane farm record created successfully",
      sugarcaneFarm: populatedFarm,
    });
  } catch (error) {
    next(error);
  }
};

export const getSugarcaneFarms = async (
  req,
  res,
  next
) => {
  try {
    const farms = await SugarcaneFarm.find()
      .populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: farms.length,
      sugarcaneFarms: farms,
    });
  } catch (error) {
    next(error);
  }
};

export const getSugarcaneFarmById = async (
  req,
  res,
  next
) => {
  try {
    const farm =
      await SugarcaneFarm.findById(
        req.params.id
      ).populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      );

    if (!farm) {
      return res.status(404).json({
        success: false,
        message:
          "Sugarcane farm record not found",
      });
    }

    res.status(200).json({
      success: true,
      sugarcaneFarm: farm,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSugarcaneFarm = async (
  req,
  res,
  next
) => {
  try {
    const farm =
      await SugarcaneFarm.findByIdAndUpdate(
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

    if (!farm) {
      return res.status(404).json({
        success: false,
        message:
          "Sugarcane farm record not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Sugarcane farm updated successfully",
      sugarcaneFarm: farm,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSugarcaneFarm = async (
  req,
  res,
  next
) => {
  try {
    const farm =
      await SugarcaneFarm.findByIdAndDelete(
        req.params.id
      );

    if (!farm) {
      return res.status(404).json({
        success: false,
        message:
          "Sugarcane farm record not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Sugarcane farm deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};