import MilkTest from "../models/MilkTest.js";

export const createMilkTest = async (req, res, next) => {
  try {
    const test = await MilkTest.create(req.body);

    res.status(201).json({
      success: true,
      message: "Milk laboratory test recorded successfully",
      data: test,
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkTests = async (req, res, next) => {
  try {
    const tests = await MilkTest.find()
      .populate("milkCollection")
      .populate("testedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: tests.length,
      data: tests,
    });
  } catch (error) {
    next(error);
  }
};

export const getMilkTestById = async (req, res, next) => {
  try {
    const test = await MilkTest.findById(req.params.id)
      .populate("milkCollection")
      .populate("testedBy", "name email");

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Milk test not found",
      });
    }

    res.json({
      success: true,
      data: test,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMilkTest = async (req, res, next) => {
  try {
    const test = await MilkTest.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Milk test not found",
      });
    }

    res.json({
      success: true,
      message: "Milk test updated successfully",
      data: test,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMilkTest = async (req, res, next) => {
  try {
    const test = await MilkTest.findByIdAndDelete(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Milk test not found",
      });
    }

    res.json({
      success: true,
      message: "Milk test deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};