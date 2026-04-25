require('dotenv').config();
const express          = require('express');
const cors             = require('cors');
const sensorRoutes     = require('./routes/sensorRoutes');
const plantRoutes      = require('./routes/plantRoutes');
const irrigationRoutes = require('./routes/irrigationRoutes');
const analyticsRoutes  = require('./routes/analyticsRoutes');
const { startScheduler } = require('./services/scheduleService');
const { initFromDB }     = require('./models/plantStore');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

app.use('/api', sensorRoutes);
app.use('/api', plantRoutes);
app.use('/api', irrigationRoutes);
app.use('/api', analyticsRoutes);

app.listen(3000, '0.0.0.0', async () => {
  console.log('Server running on port 3000');
  await initFromDB();   // hydrate in-memory cache from DB before accepting requests
  startScheduler();
});
