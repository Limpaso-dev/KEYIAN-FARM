import MilkCollection from "../models/MilkCollection.js";

// CREATE
export const createMilkCollection = async (req, res, next) => {
  try {
    const {
      quantityLitres,
      pricePerLitre,
    } = req.body;

    const payload = {
      ...req.body,
    };

    if (
      quantityLitres !== undefined &&
      pricePerLitre !== undefined
    ) {
      payload.totalAmount =
        Number(quantityLitres) * Number(pricePerLitre);
    }

    const collection = await MilkCollection.create(payload);

    const populatedCollection =
      await MilkCollection.findById(collection._id).populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      );

    res.status(201).json({
      success: true,
      message: "Milk collection recorded successfully",
      milkCollection: populatedCollection,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL
export const getMilkCollections = async (req, res, next) => {
  try {
    const collections = await MilkCollection.find()
      .populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      )
      .sort({ collectionDate: -1 });

    res.status(200).json({
      success: true,
      count: collections.length,
      milkCollections: collections,
    });
  } catch (error) {
    next(error);
  }
};

// GET ONE
export const getMilkCollectionById = async (
  req,
  res,
  next
) => {
  try {
    const collection =
      await MilkCollection.findById(req.params.id).populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Milk collection record not found",
      });
    }

    res.status(200).json({
      success: true,
      milkCollection: collection,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE
export const updateMilkCollection = async (
  req,
  res,
  next
) => {
  try {
    const payload = {
      ...req.body,
    };

    if (
      payload.quantityLitres !== undefined &&
      payload.pricePerLitre !== undefined
    ) {
      payload.totalAmount =
        Number(payload.quantityLitres) *
        Number(payload.pricePerLitre);
    }

    const collection =
      await MilkCollection.findByIdAndUpdate(
        req.params.id,
        payload,
        {
          new: true,
          runValidators: true,
        }
      ).populate(
        "farmer",
        "firstName lastName membershipNumber phone"
      );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Milk collection record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Milk collection updated successfully",
      milkCollection: collection,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE
export const deleteMilkCollection = async (
  req,
  res,
  next
) => {
  try {
    const collection =
      await MilkCollection.findByIdAndDelete(req.params.id);

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Milk collection record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Milk collection deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};