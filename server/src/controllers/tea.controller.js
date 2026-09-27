import TeaFarm from "../models/TeaFarm.js";

export const createTeaFarm = async (req, res, next) => {
  try {
    const farm = await TeaFarm.create(req.body);

    const populatedFarm = await TeaFarm.findById(
      farm._id
    ).populate(
      "farmer",
      "firstName lastName membershipNumber phone"
    );

    res.status(201).json({
      success: true,
      message: "Tea farm record created successfully",
      teaFarm: populatedFarm,
    });
  } catch (error) {
    next(error);
  }
};

export const getTeaFarms = async (req, res, next) => {
  try {
    const farms = await TeaFarm.find()
      .populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: farms.length,
      teaFarms: farms,
    });
  } catch (error) {
    next(error);
  }
};

export const getTeaFarmById = async (
  req,
  res,
  next
) => {
  try {
    const farm = await TeaFarm.findById(
      req.params.id
    ).populate(
      "farmer",
      "firstName lastName membershipNumber phone"
    );

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Tea farm record not found",
      });
    }

    res.status(200).json({
      success: true,
      teaFarm: farm,
    });
  } catch (error) {
    next(error);
  }
};

export const updateTeaFarm = async (
  req,
  res,
  next
) => {
  try {
    const farm = await TeaFarm.findByIdAndUpdate(
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
        message: "Tea farm record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tea farm updated successfully",
      teaFarm: farm,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTeaFarm = async (
  req,
  res,
  next
) => {
  try {
    const farm = await TeaFarm.findByIdAndDelete(
      req.params.id
    );

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Tea farm record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tea farm deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};