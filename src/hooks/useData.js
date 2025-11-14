// src/hooks/useData.js
import { useContext } from 'react';
import { DataContext } from '../contexts/DataContext'; // We'll export DataContext in the next step

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};