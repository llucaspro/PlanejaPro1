import { useState, useEffect, useCallback } from 'react';
import type { PlanningInput, GeneratedPlanning } from '@workspace/api-client-react';

export interface SavedPlanning {
  id: string;
  titulo: string;
  disciplina: string;
  anoSerie: string;
  createdAt: string;
  updatedAt: string;
  input: PlanningInput;
  planning: GeneratedPlanning;
}

const STORAGE_KEY = "planejapro_plannings";

function loadFromStorage(): SavedPlanning[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveToStorage(plannings: SavedPlanning[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plannings));
}

export function usePlannings() {
  const [plannings, setPlannings] = useState<SavedPlanning[]>(loadFromStorage);

  const savePlanning = useCallback((planning: SavedPlanning) => {
    setPlannings(prev => {
      const existing = prev.findIndex(p => p.id === planning.id);
      const updated = existing >= 0
        ? prev.map(p => p.id === planning.id ? planning : p)
        : [planning, ...prev];
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const updatePlanning = useCallback((id: string, updates: Partial<SavedPlanning>) => {
    setPlannings(prev => {
      const updated = prev.map(p =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      );
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const deletePlanning = useCallback((id: string) => {
    setPlannings(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const duplicatePlanning = useCallback((id: string) => {
    setPlannings(prev => {
      const original = prev.find(p => p.id === id);
      if (!original) return prev;
      const copy: SavedPlanning = {
        ...original,
        id: crypto.randomUUID(),
        titulo: `${original.titulo} (cópia)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [copy, ...prev];
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const getPlanning = useCallback((id: string) => plannings.find(p => p.id === id), [plannings]);

  return { plannings, savePlanning, updatePlanning, deletePlanning, duplicatePlanning, getPlanning };
}
