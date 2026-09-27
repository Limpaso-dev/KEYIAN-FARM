import MilkValueAddition from "../models/MilkValueAddition.js";

export const createMilkValueAddition = async (
  req,
  res,
  next
) => {
  try {
    const record = await MilkValueAddition.create(
      req.body
    );

    res.status(201).json({
      success: true,
      message:
        "Milk value addition record created successfully",
      milkValueAddition: record,
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkValueAdditions = async (
  req,
  res,
  next
) => {
  try {
    const records = await MilkValueAddition.find()
      .sort({ productionDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: records.length,
      milkValueAdditions: records,
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkValueAdditionById = async (
  req,
  res,
  next
) => {
  try {
    const record =
      await MilkValueAddition.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message:
          "Value addition record not found",
      });
    }

    res.status(200).json({
      success: true,
      milkValueAddition: record,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMilkValueAddition = async (
  req,
  res,
  next
) => {
  try {
    const record =
      await MilkValueAddition.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!record) {
      return res.status(404).json({
        success: false,
        message:
          "Value addition record not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Value addition record updated successfully",
      milkValueAddition: record,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMilkValueAddition = async (
  req,
  res,
  next
) => {
  try {
    const record =
      await MilkValueAddition.findByIdAndDelete(
        req.params.id
      );

    if (!record) {
      return res.status(404).json({
        success: false,
        message:
          "Value addition record not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Value addition record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};