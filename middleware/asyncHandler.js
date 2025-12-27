/**
//  * Middleware pour wrapper les contrôleurs async/await
//  * Gère automatiquement les erreurs et les passe à next()
//  */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;