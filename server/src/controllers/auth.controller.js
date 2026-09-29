import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

/*
 * Generate JWT
 */
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
};

/*
 * Remove sensitive fields before sending
 * user data to the frontend.
 */
const sanitizeUser = (user) => {
  const userObject = user.toObject();

  delete userObject.password;

  return userObject;
};

/*
 * LOGIN
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

/*
 * CURRENT USER
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * CREATE USER
 * POST /api/auth/users
 *
 * Only admins and super admins should be
 * allowed to access this endpoint.
 */
export const createUser = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      department,
    } = req.body;

    if (role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only a super admin can create another super admin",
      });
    }

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 12 characters",
      });
    }

    const validRoles = User.schema.path("role").enumValues;
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    if (phone !== undefined && typeof phone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Phone must be a string",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim(),
      password: hashedPassword,
      role: role || "staff",
      department: department?.trim(),
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const filter = req.user.role === "super_admin"
      ? {}
      : { role: { $ne: "super_admin" } };
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isSelf = user._id.toString() === req.user._id.toString();
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only a super admin can manage a super-admin account",
      });
    }

    if (req.body.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only a super admin can assign the super-admin role",
      });
    }

    if (
      isSelf &&
      ((req.body.role && req.body.role !== user.role) || req.body.isActive === false)
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role or deactivate your account",
      });
    }

    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
      user.name = req.body.name.trim();
    }

    if (req.body.email !== undefined) {
      if (typeof req.body.email !== "string" || !req.body.email.trim()) {
        return res.status(400).json({
          success: false,
          message: "A valid email address is required",
        });
      }
      const email = req.body.email.trim().toLowerCase();
      const duplicate = await User.findOne({
        email,
        _id: { $ne: user._id },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists",
        });
      }
      user.email = email;
    }

    if (req.body.phone !== undefined) {
      if (typeof req.body.phone !== "string") {
        return res.status(400).json({
          success: false,
          message: "Phone must be a string",
        });
      }
      user.phone = req.body.phone.trim();
    }
    if (req.body.department !== undefined) {
      if (typeof req.body.department !== "string") {
        return res.status(400).json({
          success: false,
          message: "Department must be a string",
        });
      }
      user.department = req.body.department.trim();
    }
    if (req.body.role !== undefined) {
      const validRoles = User.schema.path("role").enumValues;
      if (!validRoles.includes(req.body.role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role",
        });
      }
      user.role = req.body.role;
    }
    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Account status must be a boolean",
        });
      }
      user.isActive = req.body.isActive;
    }

    if (req.body.password) {
      if (
        typeof req.body.password !== "string" ||
        req.body.password.length < 12
      ) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 12 characters",
        });
      }
      user.password = await bcrypt.hash(req.body.password, 12);
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};