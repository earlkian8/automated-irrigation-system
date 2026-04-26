require('dotenv').config();
const express          = require('express');
const cors             = require('cors');
const sensorRoutes     = require('./routes/sensorRoutes');
const plantRoutes      = require('./routes/plantRoutes');
const irrigationRoutes = require('./routes/irrigationRoutes');
const analyticsRoutes      = require('./routes/analyticsRoutes');
const notificationRoutes   = require('./routes/notificationRoutes');
const { startScheduler }         = require('./services/scheduleService');
const { initFromDB, logActivity } = require('./models/plantStore');
const notificationService  = require('./services/notificationService');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

// Health check — Digital Ocean pings this to confirm the service is up
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api', sensorRoutes);
app.use('/api', plantRoutes);
app.use('/api', irrigationRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', notificationRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  await initFromDB();   // hydrate in-memory cache from DB before accepting requests
  startScheduler();
  notificationService.startDailySummaryCron();
  logActivity(null, 'server_start', { port: PORT });
  notificationService.sendNotification(
    'PlantPulse Online',
    'Irrigation system is back online and monitoring your plants.',
    { type: 'server_start' }
  );
});
