const express = require('express');
const cors = require('cors');
const sensorRoutes = require('./routes/sensorRoutes');
const plantRoutes = require('./routes/plantRoutes');
const irrigationRoutes = require('./routes/irrigationRoutes');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

app.use('/api', sensorRoutes);
app.use('/api', plantRoutes);
app.use('/api', irrigationRoutes);

app.listen(3000, "0.0.0.0", () => console.log('Server running on port 3000'));