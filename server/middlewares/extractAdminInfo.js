// Middleware to extract admin information from requests
// This middleware extracts admin info from request body or headers
// and makes it available to all admin routes

export function extractAdminInfo(req, res, next) {
  // Try to get admin info from various sources
  const adminInfo = {
    adminId: null,
    adminName: null,
    adminRole: null,
    department: null
  };

  // Check headers first (most reliable method)
  if (req.headers) {
    adminInfo.adminId = req.headers['x-admin-id'];
    adminInfo.adminName = req.headers['x-admin-name'];
    adminInfo.adminRole = req.headers['x-admin-role'];
    adminInfo.department = req.headers['x-admin-department'];
  }

  // Check request body (fallback for some requests)
  if (!adminInfo.adminId && req.body) {
    adminInfo.adminId = req.body.adminId;
    adminInfo.adminName = req.body.adminName;
    adminInfo.adminRole = req.body.adminRole;
    adminInfo.department = req.body.department || req.body.adminRole;
  }

  // Check query params (another fallback)
  if (!adminInfo.adminId && req.query) {
    adminInfo.adminId = req.query.adminId;
    adminInfo.adminName = req.query.adminName;
    adminInfo.adminRole = req.query.adminRole;
    adminInfo.department = req.query.department || adminInfo.adminRole;
  }

  // Make admin info available to all routes
  req.adminInfo = adminInfo;
  
  // Also add to req for backward compatibility
  req.adminId = adminInfo.adminId;
  req.adminName = adminInfo.adminName;
  req.adminRole = adminInfo.adminRole;
  req.department = adminInfo.department;

  next();
}

export default extractAdminInfo;
