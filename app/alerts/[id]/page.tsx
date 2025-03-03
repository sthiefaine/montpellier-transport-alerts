'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { Alert } from '@/lib/types';
import { formatDate, getAlertCauseLabel, getAlertEffectLabel, getAlertColor } from '@/lib/utils';
import { AlertCircle, Calendar, Clock, ArrowLeft, MapPin, Bus, AlertTriangle, ExternalLink } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AlertDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data: alert, error, isLoading } = useSWR<Alert>(
    id ? `/api/alerts/${id}` : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="container">
        <div className="text-center py-8">Chargement des détails de l'alerte...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="text-center py-8 text-red-500">
          Erreur lors du chargement de l'alerte. Veuillez réessayer plus tard.
        </div>
        <div className="text-center">
          <Link href="/alerts" className="inline-flex items-center text-blue-600 hover:underline">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour à la liste des alertes
          </Link>
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="container">
        <div className="text-center py-8 text-gray-500">Alerte non trouvée.</div>
        <div className="text-center">
          <Link href="/alerts" className="inline-flex items-center text-blue-600 hover:underline">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour à la liste des alertes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Link href="/alerts" className="inline-flex items-center text-blue-600 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Retour à la liste des alertes
      </Link>
      
      <div className={`border-l-4 p-6 rounded-md shadow ${getAlertColor(alert.effect)}`}>
        <h1 className="text-2xl font-bold mb-4">{alert.headerText}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 mb-6">
          <div className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            <div>
              <span className="font-semibold">Date de début:</span>
              <div>{formatDate(alert.timeStart)}</div>
            </div>
          </div>
          
          <div className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            <div>
              <span className="font-semibold">Date de fin:</span>
              <div>{formatDate(alert.timeEnd)}</div>
            </div>
          </div>
          
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <div>
              <span className="font-semibold">Cause:</span>
              <div>{getAlertCauseLabel(alert.cause as any)}</div>
            </div>
          </div>
          
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <div>
              <span className="font-semibold">Effet:</span>
              <div>{getAlertEffectLabel(alert.effect as any)}</div>
            </div>
          </div>
          
          {alert.routeIds && (
            <div className="flex items-center">
              <Bus className="w-5 h-5 mr-2" />
              <div>
                <span className="font-semibold">Lignes concernées:</span>
                <div>{alert.routeIds.split(',').join(', ')}</div>
              </div>
            </div>
          )}
          
          {alert.stopIds && (
            <div className="flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              <div>
                <span className="font-semibold">Arrêts concernés:</span>
                <div>{alert.stopIds.split(',').join(', ')}</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Description détaillée</h2>
          <div className="bg-white bg-opacity-50 p-4 rounded whitespace-pre-line">
            {alert.descriptionText}
          </div>
        </div>
        
        {alert.url && (
          <div className="mt-6">
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Plus d'informations <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </div>
        )}
        
        <div className="mt-8 text-sm text-gray-500">
          <div>ID de l'alerte: {alert.id}</div>
          <div>Dernière mise à jour: {formatDate(alert.updatedAt)}</div>
        </div>
      </div>
    </div>
  );
}