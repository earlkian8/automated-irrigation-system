// Dashboard plants
const plants = [
  {
    id: 1,
    name: 'Fiddle Leaf Fig',
    config: { plantType: 'Indoor', potSize: 'Large', irrigationMode: 'Auto' },
    moisture: 65,
    temperature: 22.5,
    humidity: 55,
    status: { color: '#4DB6AC', label: 'Healthy' },
    lastWatered: Date.now() - 3600000,
    nextIrrigation: Date.now() + 86400000,
    waterHistory: [
      { id: 1, type: 'manual', timestamp: Date.now() - 3600000, amount: 250 },
      { id: 2, type: 'automatic', timestamp: Date.now() - 86400000, amount: 300 },
      { id: 3, type: 'manual', timestamp: Date.now() - 172800000, amount: 250 },
      { id: 4, type: 'automatic', timestamp: Date.now() - 259200000, amount: 300 },
      { id: 5, type: 'automatic', timestamp: Date.now() - 345600000, amount: 300 },
    ],
  },
  {
    id: 2,
    name: 'Snake Plant',
    config: { plantType: 'Indoor', potSize: 'Medium', irrigationMode: 'Manual' },
    moisture: 40,
    temperature: 21.0,
    humidity: 50,
    status: { color: '#FFB74D', label: 'Needs Water' },
    lastWatered: Date.now() - 604800000,
    nextIrrigation: Date.now() + 3600000,
    waterHistory: [
      { id: 1, type: 'automatic', timestamp: Date.now() - 604800000, amount: 200 },
      { id: 2, type: 'automatic', timestamp: Date.now() - 1209600000, amount: 200 },
      { id: 3, type: 'manual', timestamp: Date.now() - 1814400000, amount: 200 },
    ],
  },
  {
    id: 3,
    name: 'Aloe Vera',
    config: { plantType: 'Succulent', potSize: 'Small', irrigationMode: 'Auto' },
    moisture: 80,
    temperature: 23.0,
    humidity: 45,
    status: { color: '#4DB6AC', label: 'Healthy' },
    lastWatered: Date.now() - 1209600000,
    nextIrrigation: Date.now() + 172800000,
    waterHistory: [
      { id: 1, type: 'automatic', timestamp: Date.now() - 1209600000, amount: 150 },
    ],
  },
];

// Analytics plants data
const analyticsPlants = [
  { id: 1, moisture: 70, totalWaterUsed: 500, waterHistory: [1, 2] },
  { id: 2, moisture: 45, totalWaterUsed: 300, waterHistory: [1, 2, 3] },
  { id: 3, moisture: 20, totalWaterUsed: 200, waterHistory: [1] },
];

// Weekly water usage data (in liters)
const weeklyWaterData = [120, 90, 150, 110, 130, 80, 100];

export { analyticsPlants, weeklyWaterData };
export default plants;