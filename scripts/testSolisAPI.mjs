import dotenv from 'dotenv';
dotenv.config();

// Correct way to access the environment variables
const apiUrl = process.env.VITE_SOLIS_API_URL;
const apiKey = process.env.VITE_SOLIS_API_ID;
const apiSecret = process.env.VITE_SOLIS_API_SECRET;

// Check if they were loaded correctly
if (!apiUrl) {
  console.error("Error: VITE_SOLIS_API_URL is not defined in your .env file.");
  process.exit(1); // Exit the script
}

console.log(`API URL successfully loaded: ${apiUrl}`);
// ... rest of your script