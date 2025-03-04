import {
  extractTramLineInfo,
  TramLinesCollection,
} from "@/services/tramLinesService";
import React from "react";

interface TramLineSummaryProps {
  tramLinesData: TramLinesCollection | null;
  isLoading: boolean;
  error: Error | null;
}

const TramLineSummary: React.FC<TramLineSummaryProps> = ({
  tramLinesData,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return (
      <div className="text-center p-4">
        Chargement des informations sur les tramways...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        Erreur lors du chargement des informations sur les tramways:{" "}
        {error.message}
      </div>
    );
  }

  if (!tramLinesData) {
    return (
      <div className="text-center p-4">
        Aucune donnée sur les tramways disponible.
      </div>
    );
  }

  const tramLines = extractTramLineInfo(tramLinesData);

  return (
    <div className="tram-line-summary">
      <h3 className="text-lg font-bold mb-3">Lignes de tramway</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {tramLines.map((line) => (
          <div
            key={line.num}
            className="bg-white rounded-lg shadow p-3 flex items-center"
            style={{ borderLeft: `4px solid ${line.color}` }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white font-bold"
              style={{ backgroundColor: line.color }}
            >
              {line.num}
            </div>
            <div>
              <div className="font-medium">{line.name}</div>
              <div className="text-xs text-gray-500">
                {line.directions.length} direction
                {line.directions.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TramLineSummary;
