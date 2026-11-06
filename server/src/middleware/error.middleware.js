export const errorHandler = (err, req, res, next) => {
  console.error(err);

  const prismaStatus = {
    P2000: 400,
    P2002: 409,
    P2003: 409,
    P2025: 404,
  }[err.code];
  const statusCode = err.statusCode || err.status || prismaStatus || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
  });
};
