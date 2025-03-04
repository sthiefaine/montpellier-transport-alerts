import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface TramLineFeature {
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

interface TramLinesCollection {
  type: string;
  features: TramLineFeature[];
}

interface TramMapProps {
  tramLinesData: TramLinesCollection;
  height?: string;
  className?: string;
}

const bounds = [
  [3.738, 43.524],
  [4.018, 43.706],
];


const TramMap: React.FC<TramMapProps> = ({
  tramLinesData,
  height = "400px",
  className = "",
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [3.876716, 43.610769],
      zoom: 12,
      attributionControl: false,
      maxBounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]],
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current.addControl(new maplibregl.FullscreenControl());

    const addTramLines = () => {
      if (!map.current || !tramLinesData || !tramLinesData.features) return;

      const lineGroups: { [key: string]: TramLineFeature[] } = {};

      tramLinesData.features.forEach((feature) => {
        const lineName = feature.properties.num_exploitation.toString();
        if (!lineGroups[lineName]) {
          lineGroups[lineName] = [];
        }
        lineGroups[lineName].push(feature);
      });

      Object.keys(lineGroups).forEach((lineName) => {
        const lineFeatures = lineGroups[lineName];
        const lineColor = lineFeatures[0].properties.code_couleur;

        const lineGeoJSON = {
          type: "FeatureCollection",
          features: lineFeatures,
        };

        map.current?.addSource(`tram-line-${lineName}`, {
          type: "geojson",
          data: lineGeoJSON as any,
        });

        map.current?.addLayer({
          id: `tram-line-${lineName}`,
          type: "line",
          source: `tram-line-${lineName}`,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": lineColor,
            "line-width": 5,
            "line-opacity": 0.8,
          },
        });

        map.current?.addLayer({
          id: `tram-stops-${lineName}`,
          type: "circle",
          source: `tram-line-${lineName}`,
          paint: {
            "circle-radius": 5,
            "circle-color": lineColor,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
          filter: ["in", "$type", "Point"],
        });
      });
    };

    map.current.on("load", addTramLines);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [tramLinesData]);

  return (
    <div className={`tram-map-container ${className}`} style={{ height }}>
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100%", borderRadius: "8px" }}
      />
    </div>
  );
};

export default TramMap;
