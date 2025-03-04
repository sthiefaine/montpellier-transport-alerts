import React, { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import tramLinesData from "@/data/transport-lines.json";

// Type pour les alertes actives
interface Alert {
  id: string;
  routeIds: string | null;
  [key: string]: any;
}

interface TransportLinesIndicatorProps {
  activeAlerts?: Alert[];
}

const TransportLinesIndicator: React.FC<TransportLinesIndicatorProps> = ({
  activeAlerts = [],
}) => {
  const [lineAlertsMap, setLineAlertsMap] = useState<Record<string, boolean>>(
    {}
  );

  // Calculer quelles lignes ont des alertes actives
  useEffect(() => {
    if (activeAlerts.length > 0) {
      const alertsMap: Record<string, boolean> = {};

      activeAlerts.forEach((alert) => {
        if (alert.routeIds) {
          const routes = alert.routeIds
            .split(/[,;|]/)
            .map((route) => route.trim())
            .filter((route) => route.length > 0);

          routes.forEach((route) => {
            alertsMap[route] = true;
          });
        }
      });

      setLineAlertsMap(alertsMap);
    }
  }, [activeAlerts]);

  // Identifier les IDs des navettes
  const navetteIds = tramLinesData
    .filter(
      (line) =>
        line.type.includes("navette") ||
        ["50", "91", "95", "96", "93"].includes(line.id.toString())
    )
    .map((line) => line.id);

  // Grouper les lignes par type
  const tramways = tramLinesData.filter((line) => line.type === "tramway");
  // Exclure les navettes des bus
  const buses = tramLinesData.filter(
    (line) => line.type === "bus" && !navetteIds.includes(line.id)
  );
  const autobus = tramLinesData.filter((line) => line.type === "autobus");
  const navettes = tramLinesData.filter(
    (line) =>
      line.type.includes("navette") ||
      ["50", "91", "95", "96", "93"].includes(line.id.toString())
  );

  // Couleur par défaut (couleur de la ligne 1)
  const defaultColor = "#005CA9";

  // Vérifier si une ligne a une alerte
  const hasAlert = (line: any) => {
    const commercialId = line.ligne_param?.commercialId;
    return commercialId && lineAlertsMap[commercialId];
  };

  // Fonction pour créer un effet 3D basé sur une couleur
  const get3DEffect = (color: string) => {
    // Convertir la couleur hexadécimale en RGB pour manipulations
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
    };

    // Créer une couleur plus claire pour le highlight
    const lightenColor = (color: string, percent: number) => {
      const rgb = hexToRgb(color);
      const lighter = {
        r: Math.min(255, Math.round(rgb.r + (255 - rgb.r) * (percent / 100))),
        g: Math.min(255, Math.round(rgb.g + (255 - rgb.g) * (percent / 100))),
        b: Math.min(255, Math.round(rgb.b + (255 - rgb.b) * (percent / 100))),
      };
      return `rgb(${lighter.r}, ${lighter.g}, ${lighter.b})`;
    };

    // Créer une couleur plus foncée pour l'ombre
    const darkenColor = (color: string, percent: number) => {
      const rgb = hexToRgb(color);
      const darker = {
        r: Math.max(0, Math.round(rgb.r * (1 - percent / 100))),
        g: Math.max(0, Math.round(rgb.g * (1 - percent / 100))),
        b: Math.max(0, Math.round(rgb.b * (1 - percent / 100))),
      };
      return `rgb(${darker.r}, ${darker.g}, ${darker.b})`;
    };

    const lighterColor = lightenColor(color, 30);
    const darkerColor = darkenColor(color, 30);

    return {
      backgroundColor: color,
      boxShadow: `0 4px 6px rgba(0, 0, 0, 0.2), inset 0 1px 1px ${lighterColor}, inset 0 -2px 1px ${darkerColor}`,
      border: `1px solid ${darkerColor}`,
      position: "relative",
      transform: "translateY(-2px)",
      transition: "all 0.1s ease-in-out",
      "&:active": {
        transform: "translateY(0)",
        boxShadow: `0 2px 2px rgba(0, 0, 0, 0.2), inset 0 1px 1px ${lighterColor}, inset 0 -1px 1px ${darkerColor}`,
      },
    };
  };

  return (
    <div className="bg-white rounded-lg shadow p-3">
      <h3 className="text-sm font-bold mb-3">Réseau de transport</h3>

      {/* Section Tramways */}
      {tramways.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-2">Tramways</div>
          <div className="flex flex-wrap gap-2">
            {tramways.map((line) => {
              const lineColor =
                line.ligne_param.ligneBackgroundColor === "#"
                  ? defaultColor
                  : `#${line.ligne_param.ligneBackgroundColor}`;
              const textColor =
                line.ligne_param.ligneTextColor === "#"
                  ? "#FFFFFF"
                  : `#${line.ligne_param.ligneTextColor}`;
              const hasIssue = hasAlert(line);

              return (
                <div key={line.id} className="relative">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-transform transform hover:scale-110 hover:-translate-y-1 active:translate-y-0 active:scale-100"
                    style={{
                      color: textColor,
                      backgroundColor: lineColor,
                      boxShadow: `0 4px 6px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.2)`,
                      border: `1px solid rgba(0, 0, 0, 0.1)`,
                      textShadow: '0 1px 1px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    {line.ligne_param.name}
                  </div>
                  {hasIssue && (
                    <AlertCircle className="absolute -top-1 -right-1 w-4 h-4 text-red-500 bg-white rounded-full shadow-md" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section Bus */}
      {buses.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-2">Bus</div>
          <div className="flex flex-wrap gap-2">
            {buses.map((line) => {
              const lineColor =
                line.ligne_param.ligneBackgroundColor === "#"
                  ? defaultColor
                  : `#${line.ligne_param.ligneBackgroundColor}`;
              const textColor =
                line.ligne_param.ligneTextColor === "#"
                  ? "#FFFFFF"
                  : `#${line.ligne_param.ligneTextColor}`;
              const hasIssue = hasAlert(line);

              return (
                <div key={line.id} className="relative">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-xl font-bold text-sm transition-transform transform hover:scale-110 hover:-translate-y-1 active:translate-y-0 active:scale-100"
                    style={{
                      color: textColor,
                      backgroundColor: lineColor,
                      boxShadow: `0 4px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -2px 0 rgba(0, 0, 0, 0.15)`,
                      border: `1px solid rgba(0, 0, 0, 0.08)`,
                      textShadow: '0 1px 1px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    {line.ligne_param.name === "Navette" ? "N" : line.ligne_param.name}
                  </div>
                  {hasIssue && (
                    <AlertCircle className="absolute -top-1 -right-1 w-4 h-4 text-red-500 bg-white rounded-full shadow-md" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section Autobus/ResaTam */}
      {autobus.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-2">ResaTam</div>
          <div className="flex flex-wrap gap-2">
            {autobus.map((line) => {
              const lineColor =
                line.ligne_param.ligneBackgroundColor === "#"
                  ? defaultColor
                  : `#${line.ligne_param.ligneBackgroundColor}`;
              const textColor =
                line.ligne_param.ligneTextColor === "#"
                  ? "#FFFFFF"
                  : `#${line.ligne_param.ligneTextColor}`;
              const hasIssue = hasAlert(line);

              return (
                <div key={line.id} className="relative">
                  <div
                    className="flex items-center justify-center w-10 h-8 rounded-xl font-bold text-sm transition-transform transform hover:scale-110 hover:-translate-y-1 active:translate-y-0 active:scale-100"
                    style={{
                      color: textColor,
                      backgroundColor: lineColor,
                      boxShadow: `0 4px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -2px 0 rgba(0, 0, 0, 0.15)`,
                      border: `1px solid rgba(0, 0, 0, 0.08)`,
                      textShadow: '0 1px 1px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    {line.ligne_param.name}
                  </div>
                  {hasIssue && (
                    <AlertCircle className="absolute -top-1 -right-1 w-4 h-4 text-red-500 bg-white rounded-full shadow-md" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section Navettes */}
      {navettes.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">Navettes</div>
          <div className="flex flex-wrap gap-2">
            {navettes.map((line) => {
              const lineColor =
                line.ligne_param.ligneBackgroundColor === "#"
                  ? defaultColor
                  : `#${line.ligne_param.ligneBackgroundColor}`;
              const textColor =
                line.ligne_param.ligneTextColor === "#"
                  ? "#FFFFFF"
                  : `#${line.ligne_param.ligneTextColor}`;
              const hasIssue = hasAlert(line);
              const displayName = line.ligne_param.name;

              return (
                <div key={line.id} className="relative">
                  <div
                    className="flex items-center justify-center w-48 h-9 rounded-3xl font-bold text-sm px-2 truncate transition-transform transform hover:scale-105 hover:-translate-y-1 active:translate-y-0 active:scale-100"
                    style={{
                      color: textColor,
                      backgroundColor: lineColor,
                      boxShadow: `0 4px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -2px 0 rgba(0, 0, 0, 0.15)`,
                      border: `1px solid rgba(0, 0, 0, 0.08)`,
                      textShadow: '0 1px 1px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    {displayName}
                  </div>
                  {hasIssue && (
                    <AlertCircle className="absolute -top-1 -right-1 w-4 h-4 text-red-500 bg-white rounded-full shadow-md" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportLinesIndicator;