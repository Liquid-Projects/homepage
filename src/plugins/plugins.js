import { log } from 'console';
import createLogger from "utils/logger";
const logger = createLogger("plugins");

const fs = require('fs');
const path = require('path');


// Function to recursively scan subdirectories for JSON files
async function scanAndImport(directory) {
  // Read the contents of the provided directory
  fs.readdir(directory, async (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }

    // Iterate through the files and directories
    for (let file of files) {
        print(file);
      const fullPath = path.join(directory, file);
      const stat = fs.statSync(fullPath);

      // If it's a directory, we want to scan it recursively
      if (stat.isDirectory()) {
        // Construct the expected path to the JSON file (e.g., 'folderName.json')
        const jsonFilePath = path.join(fullPath, `${file}.json`);

        // Check if the JSON file exists in the subfolder
        if (fs.existsSync(jsonFilePath)) {
          try {
            // Read and parse the JSON file
            const data = fs.readFileSync(jsonFilePath, 'utf-8');
            const jsonData = JSON.parse(data);

            // Extract the widget path from the JSON data
            const widgetPath = jsonData.widget;

            // Dynamically import the widget module
            const widgetModule = await import(`./${widgetPath}`);
            console.log(`Module from ${jsonFilePath} imported successfully:`, widgetModule);
            
            print(widgetModule);

            // You can now use the imported module as needed
            // Example: widgetModule.someFunction();

          } catch (error) {
            console.error(`Error reading or importing ${jsonFilePath}:`, error);
          }
        }
      }
    }
  });
}

// This function is automatically called when the module is imported
const autoImport = () => {
    logger.info("TESTING!!!!!!");
    console.log("TESTING")
    console.info("dasdasd");
    scanAndImport("")
  };
  
  // Export the function so that it can be used by other modules
  export default autoImport;
