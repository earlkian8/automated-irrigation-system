let latestReading = { raw: null, moisture: null, timestamp: null };

module.exports = {
  get: () => latestReading,
  set: (data) => {
    latestReading = { ...data, timestamp: new Date().toISOString() };
  },
};