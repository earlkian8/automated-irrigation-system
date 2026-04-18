// context/PlantContext.js
import { fetchAllPlants, fetchPlantById } from '@/services/api';
import { createContext, useCallback, useEffect, useRef, useState } from 'react';

export const PlantContext = createContext();

export const PlantProvider = ({ children }) => {
  const [plants, setPlants]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Track which plant IDs have a pending save in flight.
  // While a save is pending we skip overwriting that plant from the poll.
  const savingIds = useRef(new Set());

  const fetchPlants = useCallback(async () => {
    try {
      const data = await fetchAllPlants();
      setPlants(prev => {
        // Merge: for plants currently being saved, keep the local version
        return data.map(incoming => {
          if (savingIds.current.has(incoming.id)) {
            // Return the local copy so the UI doesn't flicker back
            const local = prev.find(p => p.id === incoming.id);
            return local ?? incoming;
          }
          return incoming;
        });
      });
      setError(null);
    } catch (e) {
      setError('Could not reach server');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refreshes a single plant — called after watering or config save.
  const refreshPlant = useCallback(async (id) => {
    try {
      const updated = await fetchPlantById(id);
      setPlants(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (e) {
      console.warn('Failed to refresh plant', id);
    }
  }, []);

  // Wraps a save operation so the polling loop won't clobber it mid-flight.
  // Usage: await protectedSave(plantId, () => saveConfig(...))
  const protectedSave = useCallback(async (id, saveFn) => {
    savingIds.current.add(id);
    try {
      const result = await saveFn();
      await refreshPlant(id);
      return result;
    } finally {
      savingIds.current.delete(id);
    }
  }, [refreshPlant]);

  useEffect(() => {
    fetchPlants();
    // Poll every 5 s for live sensor data
    const interval = setInterval(fetchPlants, 5000);
    return () => clearInterval(interval);
  }, [fetchPlants]);

  const getPlantById = (id) => plants.find(p => p.id === parseInt(id));

  return (
    <PlantContext.Provider value={{
      plants,
      loading,
      error,
      getPlantById,
      refreshPlants: fetchPlants,
      refreshPlant,
      protectedSave,
    }}>
      {children}
    </PlantContext.Provider>
  );
};