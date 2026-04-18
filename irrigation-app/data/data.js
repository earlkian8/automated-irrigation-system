import { fetchLatestSoilReading } from "../services/api";

// Store dynamic data
let plants = [
  {
    id: 1,
    name: "Fiddle Leaf Fig",
    config: { plantType: "Indoor", potSize: "Large", irrigationMode: "Auto" },
    moisture: null,
    temperature: null,
    humidity: null,
    status: { color: "#4DB6AC", label: "Healthy" },
    lastWatered: Date.now() - 3600000,
    nextIrrigation: Date.now() + 86400000,
    waterHistory: [],
  },
];

// Function to fetch latest soil reading from ESP32
export const updatePlantData = async () => {
  try {
    const data = await fetchLatestSoilReading();

    plants[0].moisture = data.moisture;
    plants[0].lastUpdated = data.timestamp;

    // Optionally, update status based on moisture
    if (data.moisture < 40) {
      plants[0].status = { color: "#FFB74D", label: "Needs Water" };
    } else {
      plants[0].status = { color: "#4DB6AC", label: "Healthy" };
    }

  } catch (error) {
    console.error("Failed to fetch plant data:", error);
  }
};

// Getter to access plant data
export const getPlants = () => plants;

export default plants;