const dotenv = require("dotenv");

dotenv.config();

const port = Number(process.env.PORT) || 3000;
const node_env = process.env.NODE_ENV || "development";

const fortnite_auth_client = process.env.FORTNITE_AUTH_CLIENT || "";
const fortnite_device_auth_file = process.env.FORTNITE_DEVICE_AUTH_FILE || "";

const app_api_key = process.env.APP_API_KEY || "";

const admin_username = process.env.ADMIN_USERNAME || "";
const admin_password = process.env.ADMIN_PASSWORD_HASH || "";
const session_secret = process.env.SESSION_SECRET || "";

const dashboard_origin = process.env.DASHBOARD_ORIGIN || "";

module.exports = {
  port,
  node_env,
  fortnite_auth_client,
  fortnite_device_auth_file,
  app_api_key,
  admin_username,
  admin_password,
  session_secret,
  dashboard_origin
};
