import Link from 'next/link';
import { AlertCircle, AlertTriangle, Calendar, Info, ArrowRight, CheckCircle } from 'lucide-react';
import { Alert } from '@/lib/types';
import { formatDate, getAlertCauseLabel, getAlertEffectLabel, getAlertColor } from '@/lib/utils';

interface AlertCardProps {
  alert: Alert;
  compact?: boolean;
}

export default function AlertCard({ alert, compact = false }: AlertCardProps) {
  // Déterminer si l'alerte est active ou terminée
  const now = new Date();
  const timeEndDate = alert.timeEnd ? new Date(alert.timeEnd) : null;
  const isActive = timeEndDate === null || timeEndDate >= now;
  
  // Fonction pour déterminer l'icône en fonction de l'effet
  const getAlertIcon = (effect: string) => {
    switch (effect) {
      case 'NO_SERVICE':
      case 'SIGNIFICANT_DELAYS':
        return <AlertCircle className="w-5 h-5 mr-2" />;
      case 'REDUCED_SERVICE':
      case 'DETOUR':
      case 'MODIFIED_SERVICE':
        return <AlertTriangle className="w-5 h-5 mr-2" />;
      default:
        return <Info className="w-5 h-5 mr-2" />;
    }
  };

  return (
    <div className={`border-l-4 p-4 rounded-md shadow-sm ${getAlertColor(alert.effect)}`}>
      <div className="flex items-start">
        {getAlertIcon(alert.effect)}
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-lg">{alert.headerText}</h3>
            {/* Badge de statut */}
            <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap
              ${isActive 
                ? 'bg-red-100 text-red-800 border border-red-300' 
                : 'bg-green-100 text-green-800 border border-green-300'}`}
            >
              {isActive 
                ? <span className="flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Active</span>
                : <span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Terminée</span>}
            </span>
          </div>
          
          {!compact && (
            <p className="mt-2 whitespace-pre-line">{alert.descriptionText}</p>
          )}
          
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              <span className="font-semibold mr-1">Début:</span> {formatDate(alert.timeStart)}
            </div>
            
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              <span className="font-semibold mr-1">Fin:</span> {formatDate(alert.timeEnd)}
            </div>
            
            {!compact && (
              <>
                <div className="flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  <span className="font-semibold mr-1">Cause:</span> {getAlertCauseLabel(alert.cause as any)}
                </div>
                
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="font-semibold mr-1">Effet:</span> {getAlertEffectLabel(alert.effect as any)}
                </div>
              </>
            )}
          </div>
          
          {!compact && alert.routeIds && (
            <div className="mt-2 text-sm">
              <span className="font-semibold">Lignes concernées:</span> {alert.routeIds.split(',').join(', ')}
            </div>
          )}
          
          {!compact && alert.stopIds && (
            <div className="mt-2 text-sm">
              <span className="font-semibold">Arrêts concernés:</span> {alert.stopIds.split(',').join(', ')}
            </div>
          )}
          
          <div className="mt-3">
            {compact ? (
              <Link 
                href={`/alerts/${alert.id}`}
                className="inline-flex items-center text-blue-600 hover:underline"
              >
                Voir les détails <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            ) : (
              alert.url && (
                <a
                  href={alert.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:underline"
                >
                  Plus d'informations <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}