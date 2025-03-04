
import { useState, useEffect } from 'react';


export interface TramLineFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  properties: {
    id_lignes_sens: string;
    reseau: string;
    mode: string;
    nom_ligne: string;
    num_exploitation: number;
    sens: string;
    fonctionnement: string;
    code_couleur: string;
  };
}


export interface TramLinesCollection {
  type: string;
  name: string;
  features: TramLineFeature[];
}


export const useTramLines = () => {
  const [tramLinesData, setTramLinesData] = useState<TramLinesCollection | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTramLines = async () => {
      try {
        setIsLoading(true);
        
        
        
        const response = await fetch('/MMM_MMM_LigneTram.json');
        
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        setTramLinesData(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur inconnue'));
        console.error('Erreur lors du chargement des données de tramway:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTramLines();
  }, []);

  return { tramLinesData, isLoading, error };
};


export const extractTramLineInfo = (data: TramLinesCollection | null) => {
  if (!data || !data.features) return [];

  const lineMap = new Map<number, { 
    num: number, 
    name: string, 
    color: string,
    directions: string[] 
  }>();

  data.features.forEach(feature => {
    const { num_exploitation, nom_ligne, code_couleur, sens } = feature.properties;
    
    if (!lineMap.has(num_exploitation)) {
      
      const baseName = nom_ligne.split(' ')[0];
      
      lineMap.set(num_exploitation, {
        num: num_exploitation,
        name: baseName,
        color: code_couleur,
        directions: [sens]
      });
    } else {
      const lineInfo = lineMap.get(num_exploitation)!;
      if (!lineInfo.directions.includes(sens)) {
        lineInfo.directions.push(sens);
      }
    }
  });

  return Array.from(lineMap.values()).sort((a, b) => a.num - b.num);
};